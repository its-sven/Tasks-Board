import {
	boardColumn,
	buildBoard,
	collectBoardTasks,
	followUpState,
	laneTaskDefaults,
	manualOrderChanges,
	parseViews,
	patchViews,
	viewFor,
	viewKeyForRoute,
} from '../../../../src/tb/board.js'
import tbBoard from '../../../../src/tb/store/board.js'
import tasksModule from '../../../../src/store/tasks.js'

import moment from '@nextcloud/moment'

import { describe, expect, it } from 'vitest'

import { link, makeCalendar, makeTask } from './helpers.js'

describe('board - columns', () => {
	const now = moment()
	const calendar = makeCalendar('c1')

	it('sorts tasks into the right columns', () => {
		expect(boardColumn(makeTask(calendar, { uid: 'a' }), now)).toBe('open')
		expect(boardColumn(makeTask(calendar, { uid: 'b', status: 'NEEDS-ACTION' }), now)).toBe('open')
		expect(boardColumn(makeTask(calendar, { uid: 'c', status: 'IN-PROCESS' }), now)).toBe('inProgress')
		expect(boardColumn(makeTask(calendar, { uid: 'd', percent: 40 }), now)).toBe('inProgress')
		expect(boardColumn(makeTask(calendar, { uid: 'e', tags: ['Netzwerk', 'waiting'] }), now)).toBe('waiting')
		expect(boardColumn(makeTask(calendar, { uid: 'f', start: now.clone().add(3, 'days') }), now)).toBe('waiting')
		expect(boardColumn(makeTask(calendar, { uid: 'g', start: now.clone() }), now)).toBe('open')
		expect(boardColumn(makeTask(calendar, { uid: 'h', status: 'COMPLETED', percent: 100, completed: now }), now)).toBe('done')
		expect(boardColumn(makeTask(calendar, { uid: 'i', status: 'CANCELLED' }), now)).toBe('cancelled')
		// Closed beats waiting
		expect(boardColumn(makeTask(calendar, { uid: 'j', status: 'COMPLETED', percent: 100, tags: ['waiting'] }), now)).toBe('done')
		// Tag check is case-insensitive
		expect(boardColumn(makeTask(calendar, { uid: 'k', tags: ['Waiting'] }), now)).toBe('waiting')
	})

	it('knows the follow-up state', () => {
		expect(followUpState(makeTask(calendar, { uid: 'l', tags: ['waiting'], start: now.clone().add(5, 'days') }), now)).toBe('pending')
		expect(followUpState(makeTask(calendar, { uid: 'm', tags: ['waiting'], start: now.clone().subtract(2, 'days') }), now)).toBe('reached')
		expect(followUpState(makeTask(calendar, { uid: 'n', tags: ['waiting'] }), now)).toBe('noDate')
		expect(followUpState(makeTask(calendar, { uid: 'o' }), now)).toBe(null)
	})
})

describe('board - collecting cards', () => {
	const now = moment()
	const calendar = makeCalendar('c2')
	const parent = makeTask(calendar, { uid: 'p', status: 'IN-PROCESS', priority: 3 })
	const child = makeTask(calendar, { uid: 'p1', related: 'p', tags: ['waiting'], start: now.clone().add(7, 'days') })
	link(parent, child)
	const oldDone = makeTask(calendar, { uid: 'old', status: 'COMPLETED', percent: 100, completed: now.clone().subtract(30, 'days') })
	const recentDone = makeTask(calendar, { uid: 'recent', status: 'COMPLETED', percent: 100, completed: now.clone().subtract(2, 'days') })
	const tagged = makeTask(calendar, { uid: 't', tags: ['Backup'] })

	it('shows only main tasks by default', () => {
		const tasks = collectBoardTasks({ calendars: [calendar], cards: 'root', now })
		expect(tasks).toContain(parent)
		expect(tasks).not.toContain(child)
	})

	it('shows subtasks as own cards if wanted', () => {
		const tasks = collectBoardTasks({ calendars: [calendar], cards: 'all', now })
		expect(tasks).toContain(parent)
		expect(tasks).toContain(child)
	})

	it('shows all completed tasks of a list, but only recent ones in collections', () => {
		expect(collectBoardTasks({ calendars: [calendar], now })).toContain(oldDone)
		const collection = collectBoardTasks({ calendars: [calendar], collectionId: 'all', now })
		expect(collection).toContain(recentDone)
		expect(collection).not.toContain(oldDone)
	})

	it('respects the tag filter', () => {
		const tasks = collectBoardTasks({ calendars: [calendar], filter: { tags: ['Backup'] }, now })
		expect(tasks).toEqual([tagged])
	})

	it('finds a main task by its subtask in search', () => {
		const tasks = collectBoardTasks({ calendars: [calendar], filter: { tags: ['waiting'] }, cards: 'root', now })
		expect(tasks).toContain(parent)
	})
})

describe('board - lanes', () => {
	const now = moment()
	const c1 = makeCalendar('l1')
	const c2 = makeCalendar('l2')
	const a = makeTask(c1, { uid: 'la', priority: 7 })
	const b = makeTask(c2, { uid: 'lb', priority: 2 })
	const c = makeTask(c1, { uid: 'lc' })
	const d = makeTask(c1, { uid: 'ld', status: 'CANCELLED' })
	const w1 = makeTask(c1, { uid: 'lw1', start: now.clone().add(10, 'days') })
	const w2 = makeTask(c1, { uid: 'lw2', start: now.clone().add(2, 'days') })

	it('groups by priority from important to someday', () => {
		const board = buildBoard([a, b, c], { lanes: 'priority', now })
		expect(board.map(lane => lane.group)).toEqual(['high', 'low', 'none'])
	})

	it('groups by list in list order', () => {
		const board = buildBoard([a, b], { lanes: 'calendar', calendars: [c2, c1], now })
		expect(board.map(lane => lane.key)).toEqual(['calendar-l2', 'calendar-l1'])
	})

	it('hides cancelled tasks unless wanted', () => {
		expect(buildBoard([c, d], { now })[0].columns.cancelled).toBeUndefined()
		expect(buildBoard([c, d], { showCancelled: true, now })[0].columns.cancelled).toEqual([d])
	})

	it('sorts the waiting column by follow-up date', () => {
		expect(buildBoard([w1, w2], { now })[0].columns.waiting).toEqual([w2, w1])
	})

	it('always returns one lane', () => {
		expect(buildBoard([], { lanes: 'priority', now })).toHaveLength(1)
	})
})

describe('board - view settings', () => {
	it('builds keys only for routes that can be a board', () => {
		expect(viewKeyForRoute({ params: { calendarId: 'work' } })).toBe('calendar:work')
		expect(viewKeyForRoute({ params: { collectionId: 'all' } })).toBe('collection:all')
		expect(viewKeyForRoute({ params: { collectionId: 'week' } })).toBe(null)
		expect(viewKeyForRoute({ params: { collectionId: 'completed' } })).toBe(null)
	})

	it('parses stored settings safely', () => {
		expect(parseViews('{"calendar:work":{"mode":"board"}}')).toEqual({ 'calendar:work': { mode: 'board' } })
		expect(parseViews('kaputt')).toEqual({})
		expect(parseViews('[]')).toEqual({})
		expect(viewFor({ 'calendar:work': { mode: 'board' } }, 'calendar:work')).toMatchObject({ mode: 'board', cards: 'root', lanes: 'none' })
	})

	it('keeps board or list for all lists once chosen', () => {
		let views = { 'calendar:work': { mode: 'board', lanes: 'priority' } }
		views = patchViews(views, 'calendar:privat', { mode: 'board' })
		expect(viewFor(views, 'calendar:privat').mode).toBe('board')
		expect(viewFor(views, 'collection:all').mode).toBe('board')
		expect(viewFor(views, 'calendar:neu').mode).toBe('board')
		views = patchViews(views, 'calendar:work', { mode: 'list' })
		expect(viewFor(views, 'calendar:privat').mode).toBe('list')
		// Other settings stay per list
		expect(viewFor(views, 'calendar:work').lanes).toBe('priority')
		views = patchViews(views, 'calendar:privat', { lanes: 'parent' })
		expect(viewFor(views, 'calendar:privat').lanes).toBe('parent')
		expect(viewFor(views, 'calendar:work').lanes).toBe('priority')
		expect(views['calendar:privat'].mode).toBeUndefined()
	})
})

describe('board - moving cards', () => {
	/**
	 * @return {object} A store context applying the real task mutations
	 */
	function context() {
		const dispatched = []
		return {
			dispatched,
			commit: (name, payload) => tasksModule.mutations[name]({}, payload),
			dispatch: async (name, payload) => { dispatched.push(name) },
			getters: { getParentTask: () => null },
		}
	}
	const move = tbBoard.actions.moveTaskToBoardColumn

	it('moves to waiting with tag and date', async () => {
		const calendar = makeCalendar('m1')
		const task = makeTask(calendar, { uid: 'mw', status: 'IN-PROCESS', percent: 20, tags: ['Netzwerk'] })
		const ctx = context()
		const date = moment().add(14, 'days')
		await move(ctx, { task, column: 'waiting', waitUntil: date.toDate() })
		expect(task.tags).toEqual(['Netzwerk', 'waiting'])
		expect(task.startMoment.format('YYYY-MM-DD')).toBe(date.format('YYYY-MM-DD'))
		expect(task.allDay).toBe(true)
		expect(task.status).toBe('IN-PROCESS')
		expect(ctx.dispatched).toEqual(['updateTask'])
	})

	it('leaving waiting removes tag and future date', async () => {
		const calendar = makeCalendar('m2')
		const task = makeTask(calendar, { uid: 'mo', tags: ['waiting', 'Backup'], start: moment().add(5, 'days') })
		const ctx = context()
		await move(ctx, { task, column: 'inProgress' })
		expect(task.tags).toEqual(['Backup'])
		expect(task.startMoment.isValid()).toBe(false)
		expect(task.status).toBe('IN-PROCESS')
		expect(ctx.dispatched).toEqual(['updateTask'])
	})

	it('moving to open resets the progress', async () => {
		const calendar = makeCalendar('m3')
		const task = makeTask(calendar, { uid: 'mp', status: 'IN-PROCESS', percent: 40 })
		await move(context(), { task, column: 'open' })
		expect(task.status).toBe('NEEDS-ACTION')
		expect(task.complete).toBe(0)
	})

	it('reopens completed tasks', async () => {
		const calendar = makeCalendar('m4')
		const task = makeTask(calendar, { uid: 'mr', status: 'COMPLETED', percent: 100, completed: moment() })
		await move(context(), { task, column: 'inProgress' })
		expect(task.completed).toBe(false)
		expect(task.status).toBe('IN-PROCESS')
	})

	it('uses the upstream actions for done and cancelled', async () => {
		const calendar = makeCalendar('m5')
		const done = makeTask(calendar, { uid: 'md', tags: ['waiting'] })
		const ctxDone = context()
		await move(ctxDone, { task: done, column: 'done' })
		expect(done.tags).toEqual([])
		expect(ctxDone.dispatched).toEqual(['setPercentComplete'])
		const cancel = makeTask(calendar, { uid: 'mc' })
		const ctxCancel = context()
		await move(ctxCancel, { task: cancel, column: 'cancelled' })
		expect(ctxCancel.dispatched).toEqual(['setStatus'])
	})

	it('does not touch read-only tasks', async () => {
		const calendar = makeCalendar('m6', { readOnly: true })
		const task = makeTask(calendar, { uid: 'mx' })
		const ctx = context()
		await move(ctx, { task, column: 'inProgress' })
		expect(task.status).toBe(null)
		expect(ctx.dispatched).toEqual([])
	})

	it('needs a date for waiting', async () => {
		const calendar = makeCalendar('m7')
		const task = makeTask(calendar, { uid: 'mn' })
		const ctx = context()
		await move(ctx, { task, column: 'waiting' })
		expect(task.tags).toEqual([])
		expect(ctx.dispatched).toEqual([])
	})
})

describe('board - adding tasks in a row', () => {
	it('takes list, main task or priority from the row', () => {
		expect(laneTaskDefaults({ type: 'all' })).toEqual({})
		expect(laneTaskDefaults({ type: 'calendar', calendarId: 'work' })).toEqual({ calendarId: 'work' })
		expect(laneTaskDefaults({ type: 'parent', parentUid: 'p1', calendarId: 'work' })).toEqual({ calendarId: 'work', related: 'p1' })
		expect(laneTaskDefaults({ type: 'parentNone' })).toEqual({})
		expect(laneTaskDefaults({ type: 'priority', group: 'high' })).toEqual({ priority: 1 })
		expect(laneTaskDefaults({ type: 'priority', group: 'low' })).toEqual({ priority: 9 })
		expect(laneTaskDefaults({ type: 'priority', group: 'none' })).toEqual({})
	})
})

describe('board - order by hand', () => {
	const cards = (...orders) => orders.map((sortOrder, index) => ({ id: index, sortOrder }))
	const result = (changes) => changes.map(change => [change.task.id, change.order])

	it('puts the card between its neighbours if there is room', () => {
		const list = cards(10, 20, 30)
		// Last card to the top
		expect(result(manualOrderChanges(list, list[2], 0))).toEqual([[2, 9]])
		// First card between the others
		expect(result(manualOrderChanges(list, list[0], 1))).toEqual([[0, 29]])
		// To the end
		expect(result(manualOrderChanges(list, list[0], 2))).toEqual([[0, 31]])
	})

	it('pushes the following cards if there is no room', () => {
		const list = cards(1, 2, 3)
		expect(result(manualOrderChanges(list, list[2], 1))).toEqual([[2, 2], [1, 3]])
		const zero = cards(0, 5)
		expect(result(manualOrderChanges(zero, zero[1], 0))).toEqual([[1, 0], [0, 1]])
	})

	it('inserts a card from another column', () => {
		const list = cards(10, 20)
		const moved = { id: 9, sortOrder: 99 }
		expect(result(manualOrderChanges(list, moved, 1))).toEqual([[9, 19]])
		expect(result(manualOrderChanges([], moved, 0))).toEqual([])
	})

	it('sorts the columns by hand when chosen', () => {
		const calendar = makeCalendar('work')
		const a = makeTask(calendar, { uid: 'a', summary: 'A' })
		const b = makeTask(calendar, { uid: 'b', summary: 'B' })
		a.sortOrder = 5
		b.sortOrder = 1
		const lanes = buildBoard([a, b], { sortOrder: 'manual' })
		expect(lanes[0].columns.open.map(task => task.uid)).toEqual(['b', 'a'])
	})
})
