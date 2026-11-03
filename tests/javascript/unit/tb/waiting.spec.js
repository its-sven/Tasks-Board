import { isTaskInList } from '../../../../src/store/storeHelper.js'
import { mapICALAlarmsToAlarmObjects } from '../../../../src/models/alarm.js'
import { boardColumn, defaultWaitingTag, followUpDate, followUpState, hasFollowUpAlarm, hasWaitingTag, isFollowUpAlarm, isFollowUpDue, isTaskWaiting, normalizeWaitingTag, setFutureStartWaits, setWaitingTag, waitingTag, writeFollowUpAlarm } from '../../../../src/tb/waiting.js'
import { setWaiting } from '../../../../src/tb/progress.js'
import { makeCalendar, makeTask } from './helpers.js'

import moment from '@nextcloud/moment'
import { describe, expect, it } from 'vitest'

describe('waiting - collections', () => {
	const now = moment()
	const setup = () => {
		const calendar = makeCalendar('work')
		return {
			calendar,
			pending: makeTask(calendar, { uid: 'p', tags: ['waiting'], start: now.clone().add(3, 'days') }),
			reached: makeTask(calendar, { uid: 'r', tags: ['Waiting'], start: now.clone().subtract(1, 'days') }),
			today: makeTask(calendar, { uid: 't', tags: ['waiting'], start: now.clone() }),
			noDate: makeTask(calendar, { uid: 'n', tags: ['waiting'] }),
			future: makeTask(calendar, { uid: 'f', start: now.clone().add(5, 'days') }),
			normal: makeTask(calendar, { uid: 'x' }),
			done: makeTask(calendar, { uid: 'd', tags: ['waiting'], status: 'COMPLETED', percent: 100, completed: now.clone() }),
		}
	}

	it('"Waiting" has all waiting tasks', () => {
		const t = setup()
		expect([t.pending, t.reached, t.today, t.noDate, t.future, t.normal, t.done].map(task => isTaskWaiting(task, now)))
			.toEqual([true, true, true, true, true, false, false])
		expect(isTaskInList(t.future, 'waiting')).toBe(true)
		expect(isTaskInList(t.normal, 'waiting')).toBe(false)
	})

	it('"Follow-up due" has waiting tasks whose date is reached or missing', () => {
		const t = setup()
		expect([t.pending, t.reached, t.today, t.noDate, t.future, t.normal, t.done].map(task => isFollowUpDue(task, now)))
			.toEqual([false, true, true, true, false, false, false])
		expect(isTaskInList(t.reached, 'followup')).toBe(true)
		expect(isTaskInList(t.pending, 'followup')).toBe(false)
	})

	it('new tasks in these collections are waiting', () => {
		const calendar = makeCalendar('work')
		const task = makeTask(calendar, { uid: 'new', tags: ['Netzwerk'] })
		setWaiting(task, 7)
		expect(task.tags).toEqual(['Netzwerk', 'waiting'])
		expect(followUpDate(task).format('YYYY-MM-DD')).toBe(moment().add(7, 'days').format('YYYY-MM-DD'))
		expect(task.startMoment.isValid()).toBe(false)
		expect(isTaskWaiting(task)).toBe(true)
		setWaiting(task, 0)
		expect(task.tags).toEqual(['Netzwerk', 'waiting'])
		expect(isFollowUpDue(task)).toBe(true)
	})
})

describe('waiting - configurable tag', () => {
	it('uses "wartet" on German instances and "waiting" otherwise', () => {
		expect(defaultWaitingTag('de')).toBe('wartet')
		expect(defaultWaitingTag('de_DE')).toBe('wartet')
		expect(defaultWaitingTag('en')).toBe('waiting')
		expect(defaultWaitingTag('fr')).toBe('waiting')
	})

	it('cleans the tag like the tag list', () => {
		expect(normalizeWaitingTag('  on  hold, later ')).toBe('on hold later')
		expect(normalizeWaitingTag('')).toBe('')
		expect(normalizeWaitingTag('x'.repeat(150))).toHaveLength(100)
	})

	it('follows a changed tag (case-insensitive)', () => {
		const calendar = makeCalendar('work')
		const old = makeTask(calendar, { uid: 'o', tags: ['waiting'] })
		const custom = makeTask(calendar, { uid: 'c', tags: ['On hold'] })
		try {
			setWaitingTag('on hold')
			expect(waitingTag()).toBe('on hold')
			expect(hasWaitingTag(custom)).toBe(true)
			expect(hasWaitingTag(old)).toBe(false)
			expect(isTaskWaiting(custom)).toBe(true)
			setWaiting(old, 3)
			expect(old.tags).toEqual(['waiting', 'on hold'])
			// An empty tag keeps the current one
			setWaitingTag('  ')
			expect(waitingTag()).toBe('on hold')
		} finally {
			setWaitingTag('waiting')
		}
		expect(hasWaitingTag(custom)).toBe(false)
	})
})

describe('waiting - start date in the future', () => {
	it('makes a task wait unless switched off, the waiting tag always does', () => {
		const cal = makeCalendar('f')
		const now = moment('2026-11-02T10:00:00')
		const planned = makeTask(cal, { uid: 'planned', start: moment('2026-11-20'), due: moment('2026-11-30') })
		const tagged = makeTask(cal, { uid: 'tagged', start: moment('2026-11-20'), tags: [waitingTag()] })
		expect(boardColumn(planned, now)).toBe('waiting')
		expect(followUpState(planned, now)).toBe('pending')
		setFutureStartWaits(false)
		try {
			expect(boardColumn(planned, now)).toBe('open')
			expect(followUpState(planned, now)).toBeNull()
			expect(boardColumn(tagged, now)).toBe('waiting')
			expect(followUpState(tagged, now)).toBe('pending')
		} finally {
			setFutureStartWaits(true)
		}
	})
})

describe('waiting - follow-up reminder', () => {
	const now = moment('2026-11-03T10:00:00')

	it('takes the follow-up date from the reminder, start and due stay the plan', () => {
		const cal = makeCalendar('fu1')
		const task = makeTask(cal, { uid: 'plan', tags: ['waiting'], start: moment('2026-11-01'), due: moment('2026-11-30'), followUp: moment('2026-11-17') })
		expect(hasFollowUpAlarm(task)).toBe(true)
		expect(followUpDate(task, now).format('YYYY-MM-DD')).toBe('2026-11-17')
		expect(followUpState(task, now)).toBe('pending')
		expect(followUpState(task, moment('2026-11-17T09:00:00'))).toBe('reached')
		expect(isFollowUpDue(task, moment('2026-11-18T09:00:00'))).toBe(true)
		// The planned start in the future does not delay a reached follow-up
		const later = makeTask(cal, { uid: 'later', tags: ['waiting'], start: moment('2026-11-20'), followUp: moment('2026-11-02') })
		expect(followUpState(later, now)).toBe('reached')
	})

	it('without the reminder the start date counts as before', () => {
		const cal = makeCalendar('fu2')
		const old = makeTask(cal, { uid: 'old', tags: ['waiting'], start: moment('2026-11-10') })
		expect(hasFollowUpAlarm(old)).toBe(false)
		expect(followUpDate(old, now).format('YYYY-MM-DD')).toBe('2026-11-10')
		expect(followUpState(old, now)).toBe('pending')
		const other = makeTask(cal, { uid: 'other', tags: ['waiting'], alarms: ['TRIGGER;VALUE=DATE-TIME:20261105T070000Z'] })
		expect(followUpDate(other, now)).toBeNull()
		expect(followUpState(other, now)).toBe('noDate')
	})

	it('writes one marked reminder at 8 o\'clock and keeps the other reminders', () => {
		const cal = makeCalendar('fu3')
		const task = makeTask(cal, { uid: 'w', alarms: ['TRIGGER:-PT15M'], followUp: moment('2026-11-10') })
		writeFollowUpAlarm(task, moment('2026-11-24'), 'Follow-up')
		expect(task.alarms).toHaveLength(2)
		expect(task.alarms.filter(isFollowUpAlarm)).toHaveLength(1)
		expect(followUpDate(task, now).format('YYYY-MM-DD')).toBe('2026-11-24')
		const ics = task.vCalendar.toString()
		expect(ics).toContain('X-TASKS-BOARD-FOLLOW-UP:1')
		expect(ics).toContain('TRIGGER;VALUE=DATE-TIME:' + moment('2026-11-24T08:00:00').utc().format('YYYYMMDD[T]HHmmss[Z]'))
		expect(ics).toContain('TRIGGER:-PT15M')
		writeFollowUpAlarm(task, null)
		expect(task.alarms).toHaveLength(1)
		expect(hasFollowUpAlarm(task)).toBe(false)
	})

	it('marks the reminder in the sidebar list', () => {
		const cal = makeCalendar('fu4')
		const task = makeTask(cal, { uid: 's', alarms: ['TRIGGER:-PT15M'], followUp: moment('2026-11-10') })
		const objects = mapICALAlarmsToAlarmObjects(task.alarms)
		expect(objects.map(alarm => isFollowUpAlarm(alarm.alarmComponent))).toEqual([false, true])
	})

	it('"Current" leaves out a waiting task until its follow-up date', () => {
		const cal = makeCalendar('fu5')
		const pending = makeTask(cal, { uid: 'cp', tags: ['waiting'], start: moment().subtract(5, 'days'), followUp: moment().add(3, 'days') })
		const reached = makeTask(cal, { uid: 'cr', tags: ['waiting'], start: moment().add(5, 'days'), followUp: moment().subtract(1, 'days') })
		const planned = makeTask(cal, { uid: 'cf', start: moment().add(5, 'days') })
		expect(isTaskInList(pending, 'current')).toBe(false)
		expect(isTaskInList(reached, 'current')).toBe(true)
		expect(isTaskInList(planned, 'current')).toBe(false)
	})
})
