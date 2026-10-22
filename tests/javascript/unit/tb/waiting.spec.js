import { isTaskInList } from '../../../../src/store/storeHelper.js'
import { defaultWaitingTag, hasWaitingTag, isFollowUpDue, isTaskWaiting, normalizeWaitingTag, setWaitingTag, waitingTag } from '../../../../src/tb/waiting.js'
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
		expect(task.startMoment.format('YYYY-MM-DD')).toBe(moment().add(7, 'days').format('YYYY-MM-DD'))
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
