import {
	attention,
	breakdown,
	countStates,
	dashboardTasks,
	filterTasks,
	niceMax,
	NOBODY,
	projectOf,
	projectOptions,
	summary,
	weeklyHistory,
	workState,
} from '../../../../src/tb/stats.js'
import { link, makeCalendar, makeTask } from './helpers.js'

import moment from '@nextcloud/moment'
import { describe, expect, it } from 'vitest'

const MAX = 'ATTENDEE;CN=Max Muster;X-NC-USERID=max;X-TASKS-BOARD-ASSIGNED-BY=admin;SCHEDULE-AGENT=CLIENT:mailto:max@example.com'
const ANNA = 'ATTENDEE;CN=Anna Beispiel;X-NC-USERID=anna;X-TASKS-BOARD-ASSIGNED-BY=admin;SCHEDULE-AGENT=CLIENT:mailto:anna@example.com'

/**
 * Two lists: a project with steps and some single tasks
 */
function setup() {
	const now = moment('2026-10-22T10:00:00')
	const work = makeCalendar('work', { displayName: 'IT General', color: '#00f' })
	const backup = makeCalendar('backup', { displayName: 'Proxmox & Backup', color: '#f00' })
	const templates = makeCalendar('vorlagen', { displayName: 'Vorlagen' })
	const t = {
		now,
		work,
		backup,
		templates,
		project: makeTask(work, { uid: 'p', summary: 'Domain-Umzug', priority: 2, status: 'IN-PROCESS', percent: 30, attendee: MAX, tags: ['Migration'] }),
		step1: makeTask(work, { uid: 'p1', summary: 'DNS', related: 'p', due: now.clone().subtract(2, 'days'), attendee: MAX }),
		step2: makeTask(work, { uid: 'p2', summary: 'Mail', related: 'p', tags: ['waiting'], start: now.clone().subtract(1, 'days'), attendee: ANNA }),
		step3: makeTask(work, { uid: 'p3', summary: 'Alt abschalten', related: 'p', status: 'COMPLETED', percent: 100, completed: now.clone().subtract(1, 'days') }),
		single: makeTask(work, { uid: 's', summary: 'Drucker', priority: 1, modified: now.clone().subtract(20, 'days'), tags: ['Hardware', 'Support'] }),
		backupTask: makeTask(backup, { uid: 'b', summary: 'PBS prüfen', priority: 5, attendee: ANNA, tags: ['Backup'], created: now.clone().subtract(8, 'days') }),
		oldDone: makeTask(backup, { uid: 'od', summary: 'Alt', status: 'COMPLETED', percent: 100, completed: now.clone().subtract(40, 'days'), created: now.clone().subtract(60, 'days') }),
		cancelled: makeTask(backup, { uid: 'c', summary: 'Weg', status: 'CANCELLED' }),
		template: makeTask(templates, { uid: 't', summary: 'Onboarding' }),
	}
	link(t.project, t.step1)
	link(t.project, t.step2)
	link(t.project, t.step3)
	return t
}

describe('stats - states and projects', () => {
	it('work states: overdue before waiting and in progress', () => {
		const t = setup()
		expect(workState(t.project, t.now)).toBe('inProgress')
		expect(workState(t.step1, t.now)).toBe('overdue')
		expect(workState(t.step2, t.now)).toBe('waiting')
		expect(workState(t.step3, t.now)).toBe('done')
		expect(workState(t.single, t.now)).toBe('open')
		expect(workState(t.cancelled, t.now)).toBe('cancelled')
	})

	it('the project of a task is its main task with subtasks', () => {
		const t = setup()
		expect(projectOf(t.step1)).toBe(t.project)
		expect(projectOf(t.project)).toBe(t.project)
		expect(projectOf(t.single)).toBe(null)
		expect(projectOptions(dashboardTasks([t.work, t.backup]))).toEqual([t.project])
	})

	it('leaves out the template list', () => {
		const t = setup()
		expect(dashboardTasks([t.work, t.backup, t.templates], 'vorlagen')).not.toContain(t.template)
	})
})

describe('stats - filters and numbers', () => {
	it('filters by list, project, person, tag and main tasks', () => {
		const t = setup()
		const all = dashboardTasks([t.work, t.backup])
		expect(filterTasks(all, { calendars: ['backup'] })).toEqual([t.backupTask, t.oldDone, t.cancelled])
		expect(filterTasks(all, { project: t.project.key })).toEqual([t.project, t.step1, t.step2, t.step3])
		expect(filterTasks(all, { people: ['anna'] })).toEqual([t.step2, t.backupTask])
		expect(filterTasks(all, { people: [NOBODY], calendars: ['work'] })).toEqual([t.step3, t.single])
		expect(filterTasks(all, { tags: ['hardware'] })).toEqual([t.single])
		expect(filterTasks(all, { rootOnly: true, calendars: ['work'] })).toEqual([t.project, t.single])
	})

	it('counts states and headline numbers', () => {
		const t = setup()
		const all = dashboardTasks([t.work, t.backup])
		expect(countStates(all, t.now)).toEqual({ inProgress: 1, waiting: 1, open: 2, overdue: 1, done: 2, cancelled: 1 })
		const numbers = summary(all, t.now)
		expect(numbers.remaining).toBe(5)
		expect(numbers.doneThisWeek).toBe(1)
		expect(numbers.done30).toBe(1)
		expect(numbers.followUps).toBe(1)
		expect(numbers.unassigned).toBe(1)
	})
})

describe('stats - breakdown', () => {
	it('per person, unassigned last, stacked by state', () => {
		const t = setup()
		const groups = breakdown(dashboardTasks([t.work, t.backup]), 'person', { now: t.now })
		expect(groups.map(group => [group.key, group.total])).toEqual([['user:anna', 2], ['user:max', 2], [NOBODY, 1]])
		expect(groups.find(group => group.key === 'user:max').counts).toEqual({ inProgress: 1, waiting: 0, open: 0, overdue: 1 })
	})

	it('per project, single tasks separately', () => {
		const t = setup()
		const groups = breakdown(dashboardTasks([t.work, t.backup]), 'project', { now: t.now })
		expect(groups.map(group => [group.label, group.total])).toEqual([['Domain-Umzug', 3], [null, 2]])
	})

	it('per priority in fixed order, per tag without the waiting tag', () => {
		const t = setup()
		const all = dashboardTasks([t.work, t.backup])
		expect(breakdown(all, 'priority', { now: t.now }).map(group => group.label)).toEqual(['high', 'medium', 'none'])
		const tags = breakdown(all, 'tag', { now: t.now }).map(group => group.label)
		expect(tags).not.toContain('waiting')
		expect(tags[tags.length - 1]).toBe(null)
	})

	it('folds small groups into "other"', () => {
		const calendar = makeCalendar('many')
		const tasks = Array.from({ length: 10 }, (_, i) => makeTask(calendar, { uid: 'm' + i, tags: ['Tag ' + i] }))
		const groups = breakdown(tasks, 'tag', { limit: 4 })
		expect(groups).toHaveLength(4)
		expect(groups[3]).toMatchObject({ key: '__other__', total: 7, other: 7 })
	})
})

describe('stats - attention and history', () => {
	it('lists overdue, follow-ups, unassigned and important tasks lying around', () => {
		const t = setup()
		const lists = attention(dashboardTasks([t.work, t.backup]), t.now)
		expect(lists.overdue).toEqual([t.step1])
		expect(lists.followUps).toEqual([t.step2])
		expect(lists.unassigned).toEqual([t.single])
		expect(lists.stale).toEqual([t.single])
	})

	it('counts new and completed tasks per week', () => {
		const t = setup()
		const weeks = weeklyHistory(dashboardTasks([t.work, t.backup]), { now: t.now, weeks: 12 })
		expect(weeks).toHaveLength(12)
		expect(weeks[11].start.format('YYYY-MM-DD')).toBe('2026-10-19')
		expect(weeks[11].completed).toBe(1)
		expect(weeks[10].created).toBe(1)
		expect(weeks.reduce((sum, week) => sum + week.completed, 0)).toBe(2)
	})

	it('clean axis ends', () => {
		expect([0, 3, 6, 11, 23, 48, 130].map(niceMax)).toEqual([5, 5, 10, 20, 25, 50, 200])
	})
})
