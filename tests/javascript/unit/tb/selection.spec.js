import selection, { handleSelectClick } from '../../../../src/tb/store/selection.js'
import { makeCalendar, makeTask } from './helpers.js'

import { describe, expect, it } from 'vitest'
import { createStore } from 'vuex'

/**
 * @param {Array} calendars The calendars
 * @return {object} A store with the selection module only
 */
function storeWith(calendars) {
	return createStore({
		modules: { tbSelection: { state: () => ({ selected: {}, mode: false, anchor: null }), getters: selection.getters, mutations: selection.mutations } },
		getters: { getSortedCalendars: () => calendars },
	})
}

const click = (extra = {}) => ({ target: document.body, preventDefault() {}, ctrlKey: false, metaKey: false, shiftKey: false, ...extra })

describe('selection - clicks', () => {
	it('selects with Ctrl/Cmd, opens normally without', () => {
		const calendar = makeCalendar('work')
		const a = makeTask(calendar, { uid: 'a' })
		const b = makeTask(calendar, { uid: 'b' })
		const store = storeWith([calendar])
		expect(handleSelectClick(store, a, click())).toBe(false)
		expect(handleSelectClick(store, a, click({ ctrlKey: true }))).toBe(true)
		expect(handleSelectClick(store, b, click({ metaKey: true }))).toBe(true)
		expect(store.getters.tbSelectedTasks.map(t => t.uid).sort()).toEqual(['a', 'b'])
		handleSelectClick(store, a, click({ ctrlKey: true }))
		expect(store.getters.tbSelectedKeys).toEqual([b.key])
	})

	it('selection mode selects with a plain click, checkboxes still work', () => {
		const calendar = makeCalendar('work')
		const a = makeTask(calendar, { uid: 'a' })
		const store = storeWith([calendar])
		store.commit('setTbSelectionMode', true)
		const checkbox = document.createElement('div')
		checkbox.className = 'task-checkbox'
		expect(handleSelectClick(store, a, click({ target: checkbox }))).toBe(false)
		expect(handleSelectClick(store, a, click())).toBe(true)
		expect(store.getters.tbSelectionCount).toBe(1)
		store.commit('setTbSelectionMode', false)
		expect(store.getters.tbSelectionCount).toBe(0)
	})

	it('Shift selects the range in the order shown', () => {
		const calendar = makeCalendar('work')
		const tasks = ['a', 'b', 'c', 'd'].map(uid => makeTask(calendar, { uid }))
		document.body.innerHTML = '<main class="app-content">' + tasks.map(t => '<div data-task-key="' + t.key + '"></div>').join('') + '</main>'
		const store = storeWith([calendar])
		handleSelectClick(store, tasks[1], click({ ctrlKey: true }))
		handleSelectClick(store, tasks[3], click({ shiftKey: true }))
		expect(store.getters.tbSelectedTasks.map(t => t.uid).sort()).toEqual(['b', 'c', 'd'])
	})
})

describe('selection - actions for all', () => {
	/**
	 * @param {Array} tasks Selected tasks
	 * @return {object} Fake store context that records dispatches
	 */
	function context(tasks) {
		const calls = []
		return {
			calls,
			getters: { tbSelectedTasks: tasks },
			commit: (type) => calls.push(['commit', type]),
			dispatch: async (type, payload) => { calls.push([type, payload.task?.uid, payload.calendar?.id ?? payload.priority ?? payload.tags ?? payload.complete]) },
		}
	}

	it('skips read-only and already matching tasks', async () => {
		const calendar = makeCalendar('work')
		const shared = makeCalendar('fremd', { readOnly: true })
		const a = makeTask(calendar, { uid: 'a', priority: 5 })
		const b = makeTask(calendar, { uid: 'b' })
		const c = makeTask(shared, { uid: 'c' })
		const ctx = context([a, b, c])
		expect(await selection.actions.tbBulk(ctx, { action: 'priority', value: 5 })).toBe(1)
		expect(ctx.calls).toEqual([['setPriority', 'b', 5]])
		const ctx2 = context([a, b])
		expect(await selection.actions.tbBulk(ctx2, { action: 'addTag', value: 'Netzwerk' })).toBe(2)
	})

	it('moves main tasks with their subtasks once and ends the selection', async () => {
		const work = makeCalendar('work')
		const other = makeCalendar('privat')
		const parent = makeTask(work, { uid: 'p' })
		const child = makeTask(work, { uid: 's', related: 'p' })
		const single = makeTask(work, { uid: 'x' })
		const ctx = context([parent, child, single])
		expect(await selection.actions.tbBulk(ctx, { action: 'move', value: other })).toBe(2)
		expect(ctx.calls.filter(call => call[0] === 'moveTask').map(call => call[1])).toEqual(['p', 'x'])
		expect(ctx.calls).toContainEqual(['commit', 'clearTbSelection'])
	})
})
