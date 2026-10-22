/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Vuex module "tbSelection": several tasks selected at once (list and board)
 * and the actions for all of them.
 *
 * Select with Ctrl/Cmd+click (one more), Shift+click (range) or in the
 * selection mode (button in the header) with a plain click. Esc clears.
 */

import { isTaskReadOnly } from './board.js'
import { assigneeOf } from '../assignee.js'

import moment from '@nextcloud/moment'

const state = {
	/** Selected tasks: task.key => true */
	selected: {},
	/** Plain clicks select instead of opening (for touch screens) */
	mode: false,
	/** Last clicked task (start of a Shift range) */
	anchor: null,
}

const getters = {
	tbSelectedKeys: (state) => Object.keys(state.selected),
	tbSelectionCount: (state) => Object.keys(state.selected).length,
	isTbSelected: (state) => (key) => !!state.selected[key],
	tbSelectionActive: (state) => state.mode || Object.keys(state.selected).length > 0,
	/**
	 * The selected tasks that are still loaded
	 *
	 * @param {object} state The module state
	 * @param {object} getters The getters
	 * @param {object} rootState The root state
	 * @param {object} rootGetters All getters
	 * @return {Array}
	 */
	tbSelectedTasks: (state, getters, rootState, rootGetters) => {
		const tasks = []
		for (const calendar of rootGetters.getSortedCalendars) {
			for (const task of Object.values(calendar.tasks)) {
				if (state.selected[task.key]) {
					tasks.push(task)
				}
			}
		}
		return tasks
	},
}

const mutations = {
	setTbSelection(state, keys) {
		state.selected = Object.fromEntries(keys.map(key => [key, true]))
	},
	toggleTbSelected(state, key) {
		const selected = { ...state.selected }
		if (selected[key]) {
			delete selected[key]
		} else {
			selected[key] = true
		}
		state.selected = selected
		state.anchor = key
	},
	setTbSelectionAnchor(state, key) {
		state.anchor = key
	},
	setTbSelectionMode(state, mode) {
		state.mode = !!mode
		if (!mode) {
			state.selected = {}
			state.anchor = null
		}
	},
	clearTbSelection(state) {
		state.selected = {}
		state.anchor = null
		state.mode = false
	},
}

/**
 * Keys of the tasks between two tasks, in the order they are shown
 *
 * @param {string} from Key of the first task
 * @param {string} to Key of the last task
 * @return {string[]}
 */
function visibleRange(from, to) {
	const keys = [...document.querySelectorAll('.app-content [data-task-key]')]
		.map(element => element.dataset.taskKey)
		.filter((key, index, all) => all.indexOf(key) === index)
	const a = keys.indexOf(from)
	const b = keys.indexOf(to)
	if (a === -1 || b === -1) {
		return [to]
	}
	return keys.slice(Math.min(a, b), Math.max(a, b) + 1)
}

/**
 * Handles a click on a task row or card. Returns true if the click selected
 * (then the task must not be opened).
 *
 * @param {object} store The Vuex store
 * @param {object} task The clicked task
 * @param {MouseEvent} $event The click
 * @return {boolean}
 */
export function handleSelectClick(store, task, $event) {
	if (!$event || $event.target?.closest?.('.no-nav, .task-checkbox, .tb-card__checkbox, .tb-card__subtoggle, .tb-card__subtasks, a')) {
		return false
	}
	const additive = $event.ctrlKey || $event.metaKey
	const range = $event.shiftKey
	if (!additive && !range && !store.state.tbSelection.mode) {
		return false
	}
	$event.preventDefault?.()
	if (range && store.state.tbSelection.anchor) {
		const keys = visibleRange(store.state.tbSelection.anchor, task.key)
		const current = additive ? store.getters.tbSelectedKeys : []
		store.commit('setTbSelection', [...new Set([...current, ...keys])])
		return true
	}
	store.commit('toggleTbSelected', task.key)
	return true
}

/**
 * Leaves out subtasks whose main task is selected as well (they move along)
 *
 * @param {Array} tasks The selected tasks
 * @return {Array}
 */
function withoutSelectedChildren(tasks) {
	const keys = new Set(tasks.map(task => task.calendar.id + '/' + task.uid))
	return tasks.filter(task => !task.related || !keys.has(task.calendar.id + '/' + task.related))
}

const actions = {
	/**
	 * Applies an action to all selected tasks (read-only ones are skipped)
	 *
	 * @param {object} context The store context
	 * @param {object} data Destructuring object
	 * @param {string} data.action complete, reopen, column, assign, addTag, removeTag, priority, due, move
	 * @param {*} data.value The value for the action
	 * @return {Promise<number>} Number of changed tasks
	 */
	async tbBulk(context, { action, value = null }) {
		let tasks = context.getters.tbSelectedTasks.filter(task => !isTaskReadOnly(task))
		if (action === 'move') {
			tasks = withoutSelectedChildren(tasks).filter(task => task.calendar.id !== value?.id)
		}
		let changed = 0
		for (const task of tasks) {
			switch (action) {
			case 'complete':
				if (!task.closed) {
					await context.dispatch('setPercentComplete', { task, complete: 100 })
					changed++
				}
				break
			case 'reopen':
				if (task.completed) {
					await context.dispatch('setPercentComplete', { task, complete: 0 })
					changed++
				} else if (task.status === 'CANCELLED') {
					await context.dispatch('setStatus', { task, status: 'NEEDS-ACTION' })
					changed++
				}
				break
			case 'column':
				await context.dispatch('moveTaskToBoardColumn', { task, column: value.column, waitUntil: value.waitUntil || null })
				changed++
				break
			case 'assign':
				if ((assigneeOf(task)?.uid || null) !== (value?.uid || null)) {
					await context.dispatch('setTbAssignee', { task, person: value })
					changed++
				}
				break
			case 'addTag':
				if (!task.tags.includes(value)) {
					await context.dispatch('setTags', { task, tags: [...task.tags, value] })
					changed++
				}
				break
			case 'removeTag':
				if (task.tags.includes(value)) {
					await context.dispatch('setTags', { task, tags: task.tags.filter(tag => tag !== value) })
					changed++
				}
				break
			case 'priority':
				if (+task.priority !== +value) {
					await context.dispatch('setPriority', { task, priority: value })
					changed++
				}
				break
			case 'due':
				await context.dispatch('setDue', {
					task,
					due: value === null ? null : moment().add(value, 'days').startOf('day'),
					allDay: true,
				})
				changed++
				break
			case 'move':
				await context.dispatch('moveTask', { task, calendar: value })
				changed++
				break
			}
		}
		if (action === 'move') {
			// The tasks got new keys in the other list
			context.commit('clearTbSelection')
		}
		return changed
	},
}

export default { state, getters, mutations, actions }
