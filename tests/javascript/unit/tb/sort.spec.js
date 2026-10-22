import { groupTasks, sort, sortKeyForRoute } from '../../../../src/tb/sort.js'

import moment from '@nextcloud/moment'

import { describe, expect, it } from 'vitest'

import { makeCalendar, makeTask } from './helpers.js'

describe('sort - orders', () => {
	const now = moment()
	const calendar = makeCalendar('s1')
	const open = makeTask(calendar, { uid: 'so', summary: 'B offen', priority: 5 })
	const progress = makeTask(calendar, { uid: 'sp', summary: 'A in Arbeit', status: 'IN-PROCESS', percent: 60 })
	const waiting = makeTask(calendar, { uid: 'sw', summary: 'C waiting', tags: ['waiting'] })
	const openHigh = makeTask(calendar, { uid: 'sh', summary: 'D offen wichtig', priority: 2 })

	it('sorts by status: in progress, open (by priority), waiting', () => {
		expect(sort([waiting, open, progress, openHigh], 'status', false, now)).toEqual([progress, openHigh, open, waiting])
	})

	it('reverses with the sort direction', () => {
		expect(sort([waiting, open, progress, openHigh], 'status', true, now)).toEqual([waiting, open, openHigh, progress])
	})

	it('sorts by progress, most advanced first', () => {
		expect(sort([open, progress], 'progress', false, now)[0]).toBe(progress)
	})

	it('delegates other orders to upstream', () => {
		expect(sort([open, progress, waiting], 'alphabetically', false, now).map(t => t.uid)).toEqual(['sp', 'so', 'sw'])
	})
})

describe('sort - groups', () => {
	const now = moment()
	const calendar = makeCalendar('g1')
	const a = makeTask(calendar, { uid: 'ga', tags: ['Netzwerk', 'Hardware'], priority: 3 })
	const b = makeTask(calendar, { uid: 'gb', tags: ['waiting'], priority: 7 })
	const c = makeTask(calendar, { uid: 'gc', tags: ['Backup'], status: 'IN-PROCESS' })

	it('groups by tag, a task appears under each tag, waiting is no category', () => {
		const groups = groupTasks([a, b, c], 'tag', now)
		expect(groups.map(g => g.value)).toEqual(['Backup', 'Hardware', 'Netzwerk', null])
		expect(groups[3].type).toBe('tagNone')
		expect(groups[3].tasks).toEqual([b])
	})

	it('groups by status in the order of the board', () => {
		expect(groupTasks([a, b, c], 'status', now).map(g => g.value)).toEqual(['inProgress', 'open', 'waiting'])
	})

	it('groups by priority level', () => {
		expect(groupTasks([a, b, c], 'priority', now).map(g => g.value)).toEqual(['high', 'low', 'none'])
	})

	it('has keys for every list and collection', () => {
		expect(sortKeyForRoute({ params: { calendarId: 'work' } })).toBe('calendar:work')
		expect(sortKeyForRoute({ params: { collectionId: 'week' } })).toBe('collection:week')
	})
})
