import { applyNewTaskDefaults, applyProgress, computeProgress, parsePrefs } from '../../../../src/tb/progress.js'

import moment from '@nextcloud/moment'

import { describe, expect, it } from 'vitest'

import { link, makeCalendar, makeTask } from './helpers.js'

describe('progress', () => {
	it('counts done subtasks, ignores cancelled ones', () => {
		const calendar = makeCalendar('p1')
		const parent = makeTask(calendar, { uid: 'pp' })
		link(parent, makeTask(calendar, { uid: 'p1', related: 'pp', status: 'COMPLETED', percent: 100, completed: moment() }))
		link(parent, makeTask(calendar, { uid: 'p2', related: 'pp' }))
		link(parent, makeTask(calendar, { uid: 'p3', related: 'pp', status: 'CANCELLED' }))
		link(parent, makeTask(calendar, { uid: 'p4', related: 'pp', status: 'IN-PROCESS' }))
		expect(computeProgress(parent)).toBe(33)
	})

	it('stops at 99 % so the main task stays open', () => {
		const calendar = makeCalendar('p2')
		const parent = makeTask(calendar, { uid: 'pq' })
		link(parent, makeTask(calendar, { uid: 'q1', related: 'pq', status: 'COMPLETED', percent: 100, completed: moment() }))
		expect(computeProgress(parent)).toBe(99)
	})

	it('has no progress without active subtasks', () => {
		const calendar = makeCalendar('p3')
		const parent = makeTask(calendar, { uid: 'pr' })
		expect(computeProgress(parent)).toBe(null)
		link(parent, makeTask(calendar, { uid: 'r1', related: 'pr', status: 'CANCELLED' }))
		expect(computeProgress(parent)).toBe(null)
	})

	it('writes the progress without completing and sets in progress', () => {
		const calendar = makeCalendar('p4')
		const parent = makeTask(calendar, { uid: 'ps', status: 'NEEDS-ACTION' })
		expect(applyProgress(parent, 99)).toBe(true)
		expect(parent.complete).toBe(99)
		expect(parent.status).toBe('IN-PROCESS')
		expect(parent.completed).toBe(false)
		expect(applyProgress(parent, 99)).toBe(false)
	})

	it('keeps the status at 0 %', () => {
		const calendar = makeCalendar('p5')
		const parent = makeTask(calendar, { uid: 'pt', status: 'NEEDS-ACTION', percent: 50 })
		applyProgress(parent, 0)
		expect(parent.complete).toBe(0)
		expect(parent.status).toBe('NEEDS-ACTION')
	})
})

describe('new tasks', () => {
	it('inherits priority and tags (without the waiting tag) and sets needs action', () => {
		const calendar = makeCalendar('n1')
		const parent = makeTask(calendar, { uid: 'np', priority: 3, tags: ['Netzwerk', 'waiting'] })
		const task = makeTask(calendar, { uid: 'nc', related: 'np', tags: ['Hardware'] })
		applyNewTaskDefaults(task, parent, parsePrefs('{}'))
		expect(task.status).toBe('NEEDS-ACTION')
		expect(task.priority).toBe(3)
		expect(task.tags).toEqual(['Hardware', 'Netzwerk'])
	})

	it('keeps an own priority and respects the preference', () => {
		const calendar = makeCalendar('n2')
		const parent = makeTask(calendar, { uid: 'nq', priority: 3, tags: ['Backup'] })
		const own = makeTask(calendar, { uid: 'nd', related: 'nq', priority: 1 })
		applyNewTaskDefaults(own, parent, parsePrefs('{}'))
		expect(own.priority).toBe(1)
		const off = makeTask(calendar, { uid: 'ne', related: 'nq' })
		applyNewTaskDefaults(off, parent, parsePrefs('{"inheritFromParent":false}'))
		expect(off.priority).toBe(0)
		expect(off.tags).toEqual([])
		expect(off.status).toBe('NEEDS-ACTION')
	})

	it('parses preferences safely', () => {
		const defaults = { autoProgress: true, inheritFromParent: true, notifyAssigned: true, notifyCompleted: true, notifyFollowUp: true, notifyDue: true, templateCalendarId: '', listStyle: 'cards', collectionOrder: null }
		expect(parsePrefs('kaputt')).toEqual(defaults)
		expect(parsePrefs({ autoProgress: false })).toEqual({ ...defaults, autoProgress: false })
		expect(parsePrefs('{"notifyCompleted":false}')).toEqual({ ...defaults, notifyCompleted: false })
	})
})
