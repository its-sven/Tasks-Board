import { assigneeOf, initials, matchesAssigneeFilter, peopleOf, readAssignee, UNASSIGNED, writeAssignee } from '../../../../src/tb/assignee.js'
import { buildBoard, laneTaskDefaults } from '../../../../src/tb/board.js'
import { applyNewTaskDefaults, DEFAULT_PREFS } from '../../../../src/tb/progress.js'
import { groupTasks, sort } from '../../../../src/tb/sort.js'
import { makeCalendar, makeTask } from './helpers.js'

import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'

const MAX = { uid: 'max', displayName: 'Max Muster', email: 'max@example.com' }
const ANNA = { uid: 'anna', displayName: 'Anna Beispiel', email: '' }

describe('assignee - stored as ATTENDEE', () => {
	it('reads an assignment written by another Tasks Board client', () => {
		const calendar = makeCalendar('work')
		const task = makeTask(calendar, { uid: 't1', attendee: 'ATTENDEE;CN=Max Muster;X-NC-USERID=max;X-TASKS-BOARD-ASSIGNED-BY=admin;SCHEDULE-AGENT=CLIENT:mailto:max@example.com' })
		expect(assigneeOf(task)).toEqual({ uid: 'max', displayName: 'Max Muster', email: 'max@example.com', assignedBy: 'admin' })
	})

	it('ignores attendees of other clients and keeps them', () => {
		const calendar = makeCalendar('work')
		const task = makeTask(calendar, { uid: 't2', attendee: 'ATTENDEE;CN=Extern:mailto:extern@example.com' })
		expect(assigneeOf(task)).toBe(null)
		writeAssignee(task.vtodo, MAX, 'admin')
		const attendees = task.vtodo.getAllProperties('attendee')
		expect(attendees).toHaveLength(2)
		writeAssignee(task.vtodo, null, 'admin')
		expect(task.vtodo.getAllProperties('attendee').map(p => p.getFirstValue())).toEqual(['mailto:extern@example.com'])
	})

	it('writes one assignee with the parameters other clients understand', () => {
		const vtodo = new ICAL.Component('vtodo')
		writeAssignee(vtodo, MAX, 'admin')
		writeAssignee(vtodo, ANNA, 'admin')
		const attendees = vtodo.getAllProperties('attendee')
		expect(attendees).toHaveLength(1)
		const text = attendees[0].toICALString()
		expect(text).toContain('X-NC-USERID=anna')
		expect(text).toContain('SCHEDULE-AGENT=CLIENT')
		expect(text).toContain('X-TASKS-BOARD-ASSIGNED-BY=admin')
		expect(text).toContain('urn:x-nextcloud:user:anna')
		expect(readAssignee(vtodo)).toMatchObject({ uid: 'anna', displayName: 'Anna Beispiel' })
	})

	it('survives saving and loading', () => {
		const calendar = makeCalendar('work')
		const task = makeTask(calendar, { uid: 't3' })
		task._tbAssignee = writeAssignee(task.vtodo, MAX, 'admin')
		const ics = ICAL.stringify(task.jCal)
		const again = makeTask(makeCalendar('x'), { uid: 'dummy' })
		again.vCalendar = new ICAL.Component(ICAL.parse(ics))
		again.initTodo()
		expect(assigneeOf(again)).toMatchObject({ uid: 'max', email: 'max@example.com', assignedBy: 'admin' })
	})

	it('filters, collects people and makes initials', () => {
		const calendar = makeCalendar('work')
		const a = makeTask(calendar, { uid: 'a' })
		const b = makeTask(calendar, { uid: 'b' })
		a._tbAssignee = writeAssignee(a.vtodo, MAX, 'admin')
		expect(matchesAssigneeFilter(a, { tags: [] })).toBe(true)
		expect(matchesAssigneeFilter(a, { tbAssignees: ['max'] })).toBe(true)
		expect(matchesAssigneeFilter(b, { tbAssignees: ['max'] })).toBe(false)
		expect(matchesAssigneeFilter(b, { tbAssignees: [UNASSIGNED] })).toBe(true)
		expect(b.matches('', { tags: [], tbAssignees: ['max'] })).toBe(false)
		expect(peopleOf([a, b])).toEqual([{ uid: 'max', displayName: 'Max Muster' }])
		expect(initials('Max Muster')).toBe('MM')
		expect(initials('')).toBe('?')
	})
})

describe('assignee - sorting, groups, board rows, subtasks', () => {
	const setup = () => {
		const calendar = makeCalendar('work')
		const t1 = makeTask(calendar, { uid: 't1', summary: 'Zeta', status: 'NEEDS-ACTION' })
		const t2 = makeTask(calendar, { uid: 't2', summary: 'Alpha', status: 'NEEDS-ACTION' })
		const t3 = makeTask(calendar, { uid: 't3', summary: 'Beta', status: 'NEEDS-ACTION' })
		t1._tbAssignee = writeAssignee(t1.vtodo, ANNA, 'admin')
		t3._tbAssignee = writeAssignee(t3.vtodo, MAX, 'admin')
		return { calendar, t1, t2, t3 }
	}

	it('sorts by person, unassigned last', () => {
		const { t1, t2, t3 } = setup()
		expect(sort([t2, t3, t1], 'assignee').map(t => t.summary)).toEqual(['Zeta', 'Beta', 'Alpha'])
	})

	it('groups by person', () => {
		const { t1, t2, t3 } = setup()
		const groups = groupTasks([t1, t2, t3], 'assignee')
		expect(groups.map(g => [g.type, g.value, g.tasks.length])).toEqual([['assignee', 'Anna Beispiel', 1], ['assignee', 'Max Muster', 1], ['assigneeNone', null, 1]])
	})

	it('shows board rows per person and new tasks in a row get that person', () => {
		const { calendar, t1, t2, t3 } = setup()
		const lanes = buildBoard([t1, t2, t3], { lanes: 'assignee', calendars: [calendar] })
		expect(lanes.map(l => l.type + ':' + (l.title || ''))).toEqual(['assignee:Anna Beispiel', 'assignee:Max Muster', 'assigneeNone:'])
		expect(laneTaskDefaults(lanes[1])).toEqual({ assignee: { uid: 'max', displayName: 'Max Muster', email: 'max@example.com' } })
		expect(laneTaskDefaults(lanes[2])).toEqual({})
	})

	it('new subtasks take over the person of the main task', () => {
		const { calendar, t3 } = setup()
		const sub = makeTask(calendar, { uid: 's1', related: 't3' })
		applyNewTaskDefaults(sub, t3, DEFAULT_PREFS)
		expect(assigneeOf(sub)).toMatchObject({ uid: 'max', assignedBy: 'admin' })
		const other = makeTask(calendar, { uid: 's2', related: 't3' })
		applyNewTaskDefaults(other, t3, { ...DEFAULT_PREFS, inheritFromParent: false })
		expect(assigneeOf(other)).toBe(null)
	})
})
