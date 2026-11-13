import calendarsModule from '../../../../src/store/calendars.js'
import { isTaskInList } from '../../../../src/store/storeHelper.js'
import { closedTaskInCollection } from '../../../../src/tb/board.js'
import { hiddenListsAfter, isListHidden, setHiddenLists } from '../../../../src/tb/hidden.js'
import { makeCalendar, makeTask } from './helpers.js'

import moment from '@nextcloud/moment'
import { afterEach, describe, expect, it } from 'vitest'

describe('hidden lists', () => {
	afterEach(() => setHiddenLists([]))

	it('stores the ids without duplicates', () => {
		expect(hiddenListsAfter(undefined, 'a', true)).toEqual(['a'])
		expect(hiddenListsAfter(['a', 'b'], 'a', true)).toEqual(['b', 'a'])
		expect(hiddenListsAfter(['a', 'b'], 'a', false)).toEqual(['b'])
		setHiddenLists(['a', '', 5])
		expect(isListHidden('a')).toBe(true)
		expect(isListHidden({ id: 'a' })).toBe(true)
		expect(isListHidden({ id: 'b' })).toBe(false)
		expect(isListHidden(null)).toBe(false)
	})

	it('leaves their tasks out of the collections, not out of the list itself', () => {
		const events = makeCalendar('personal')
		const work = makeCalendar('work')
		const hiddenTask = makeTask(events, { uid: 'h', due: moment(), priority: 1 })
		const shownTask = makeTask(work, { uid: 's', due: moment(), priority: 1 })
		setHiddenLists(['personal'])
		for (const collection of ['all', 'current', 'starred', 'today', 'week']) {
			expect(isTaskInList(hiddenTask, collection)).toBe(false)
			expect(isTaskInList(shownTask, collection)).toBe(true)
		}
		expect(isTaskInList(hiddenTask, 'personal')).toBe(true)
		const done = makeTask(events, { uid: 'd', status: 'COMPLETED', percent: 100, completed: moment() })
		expect(closedTaskInCollection(done, 'all', moment(), 'admin')).toBe(false)
		setHiddenLists([])
		expect(isTaskInList(hiddenTask, 'all')).toBe(true)
	})

	it('are not offered as lists and are no default list', () => {
		const lists = [
			{ ...makeCalendar('personal'), order: 0, supportsTasks: true },
			{ ...makeCalendar('work'), order: 1, supportsTasks: true },
			{ ...makeCalendar('team'), order: 2, supportsTasks: true },
		]
		const state = { calendars: lists }
		const getters = {}
		for (const [name, getter] of Object.entries(calendarsModule.getters)) {
			Object.defineProperty(getters, name, { get: () => getter(state, getters, { settings: { settings: { defaultCalendarId: 'personal' } } }) })
		}
		setHiddenLists(['personal'])
		expect(getters.getSortedWritableCalendars.map(c => c.id)).toEqual(['work', 'team'])
		expect(getters.tbShownCalendars.map(c => c.id)).toEqual(['work', 'team'])
		expect(getters.tbHiddenCalendars.map(c => c.id)).toEqual(['personal'])
		expect(getters.getDefaultCalendar.id).toBe('work')
		setHiddenLists([])
		expect(getters.getDefaultCalendar.id).toBe('personal')
	})
})
