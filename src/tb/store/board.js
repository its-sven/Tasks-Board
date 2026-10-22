/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import Requests from '../../services/requests.js'
import { waitingTag, isWaitingTagName, hasWaitingTag, startsInFuture, parseViews, patchViews, viewFor } from '../board.js'
import { parsePrefs } from '../progress.js'
import { sortKeyForRoute } from '../sort.js'

import moment from '@nextcloud/moment'
import { generateUrl } from '@nextcloud/router'

/**
 * @param {object} task The task
 * @return {boolean} Whether the current user may not edit the task
 */
export function isTaskReadOnly(task) {
	return task.calendar.readOnly || (task.calendar.isSharedWithMe && task.class !== 'PUBLIC')
}

const EXPANDED_STORAGE_KEY = 'tasks_board.expandedCards'
const COLLAPSED_STORAGE_KEY = 'tasks_board.collapsedTasks'
const KEYS_LIMIT = 300

/**
 * A set of task keys remembered per browser
 *
 * @param {string} storageKey The localStorage key
 * @return {object} task.key => true
 */
function loadKeys(storageKey) {
	try {
		const keys = JSON.parse(window.localStorage.getItem(storageKey) || '[]')
		return Array.isArray(keys) ? Object.fromEntries(keys.map(key => [key, true])) : {}
	} catch {
		return {}
	}
}

/**
 * @param {string} storageKey The localStorage key
 * @param {object} keys task.key => true
 */
function saveKeys(storageKey, keys) {
	try {
		window.localStorage.setItem(storageKey, JSON.stringify(Object.keys(keys).filter(key => keys[key]).slice(-KEYS_LIMIT)))
	} catch {
		// Private window or blocked storage: only remembered until reload
	}
}

/**
 * @param {object} keys task.key => true
 * @param {string} key The key to switch
 * @param {boolean|null} value New state, null = toggle
 * @return {object} The new set
 */
function switchKey(keys, key, value = null) {
	const result = { ...keys }
	const on = value === null ? !result[key] : value
	if (on) {
		result[key] = true
	} else {
		delete result[key]
	}
	return result
}

const state = {
	/** Key of the list or collection currently shown (see sortKeyForRoute) */
	currentKey: null,
	/** Board cards with opened subtasks (task.key => true) */
	expandedCards: loadKeys(EXPANDED_STORAGE_KEY),
	/** List rows with closed subtasks (task.key => true) */
	collapsedTasks: loadKeys(COLLAPSED_STORAGE_KEY),
	/** Target list for new tasks chosen in a single list view (only until reload) */
	targetOverrides: {},
}

const mutations = {
	/**
	 * Opens or closes the subtasks of a board card
	 *
	 * @param {object} state The module state
	 * @param {string} key The key of the task
	 */
	setTbTargetOverride(state, { key, calendarId }) {
		state.targetOverrides = { ...state.targetOverrides, [key]: calendarId }
	},

	toggleTbCardExpanded(state, key) {
		state.expandedCards = switchKey(state.expandedCards, key)
		saveKeys(EXPANDED_STORAGE_KEY, state.expandedCards)
	},

	/**
	 * Opens or closes the subtasks of list rows
	 *
	 * @param {object} state The module state
	 * @param {object} data Destructuring object
	 * @param {string[]} data.keys The keys of the tasks
	 * @param {boolean|null} data.collapsed New state, null = toggle
	 */
	setTbCollapsed(state, { keys, collapsed = null }) {
		let result = state.collapsedTasks
		for (const key of keys) {
			result = switchKey(result, key, collapsed)
		}
		state.collapsedTasks = result
		saveKeys(COLLAPSED_STORAGE_KEY, result)
	},

	/**
	 * @param {object} state The module state
	 * @param {string|null} key The key of the current list or collection
	 */
	setTbCurrentKey(state, key) {
		state.currentKey = key
	},
}

/**
 * Saves a user setting of Tasks Board
 *
 * @param {string} type The setting
 * @param {object} value The value (stored as JSON)
 */
async function saveSetting(type, value) {
	try {
		await Requests.post(generateUrl('apps/' + appName + '/api/v1/settings/{type}', { type }), { value: JSON.stringify(value) })
	} catch (error) {
		console.error('Could not save the setting ' + type, error)
	}
}

const getters = {
	/**
	 * All stored board/list view settings
	 *
	 * @param {object} state The module state
	 * @param {object} getters The getters
	 * @param {object} rootState The root state
	 * @return {object} The view settings by key
	 */
	tbViews: (state, getters, rootState) => parseViews(rootState.settings.settings.tbViews),

	/**
	 * View settings for one key, filled with defaults
	 *
	 * @param {object} state The module state
	 * @param {object} getters The getters
	 * @return {Function} key => view settings
	 */
	tbView: (state, getters) => (key) => viewFor(getters.tbViews, key),

	/**
	 * Preferences of Tasks Board (automatic progress, inheritance)
	 *
	 * @param {object} state The module state
	 * @param {object} getters The getters
	 * @param {object} rootState The root state
	 * @return {object} The preferences
	 */
	tbPrefs: (state, getters, rootState) => parsePrefs(rootState.settings.settings.tbPrefs),

	/**
	 * Settings of the list or collection currently shown
	 *
	 * @param {object} state The module state
	 * @param {object} getters The getters
	 * @return {object} The view settings
	 */
	tbCurrentView: (state, getters) => getters.tbView(state.currentKey),

	/**
	 * Sort order of the current list, or null to use the global one.
	 * Used by the sortOrder getter of the settings module.
	 *
	 * @param {object} state The module state
	 * @param {object} getters The getters
	 * @return {string|null}
	 */
	tbSortOrder: (state, getters) => getters.tbCurrentView.sortOrder ?? null,

	/**
	 * @param {object} state The module state
	 * @param {object} getters The getters
	 * @return {boolean|null} Sort direction of the current list, or null
	 */
	tbSortDirection: (state, getters) => getters.tbCurrentView.sortDirection ?? null,

	/**
	 * @param {object} state The module state
	 * @param {object} getters The getters
	 * @return {string} Sort order of subtasks ('inherit' = like main tasks)
	 */
	tbSubtaskOrder: (state, getters) => getters.tbCurrentView.subtaskOrder || 'inherit',

	/**
	 * @param {object} state The module state
	 * @param {object} getters The getters
	 * @return {string} Grouping of the list view
	 */
	tbGrouping: (state, getters) => getters.tbCurrentView.grouping || 'none',
	isTbCollapsed: (state) => (key) => !!state.collapsedTasks[key],

	/**
	 * The list new tasks from the header input go to.
	 * Collections remember the choice (stored with the view settings),
	 * a single list only until reload; default is the list itself or the default list.
	 *
	 * @param {object} state The module state
	 * @param {object} getters The getters
	 * @param {object} rootState The root state
	 * @param {object} rootGetters All getters
	 * @return {Function} (route) => calendar
	 */
	tbTargetCalendar: (state, getters, rootState, rootGetters) => (route) => {
		const key = sortKeyForRoute(route)
		const chosen = route.params.calendarId ? state.targetOverrides[key] : getters.tbViews[key]?.targetCalendarId
		if (chosen) {
			const calendar = rootGetters.getCalendarById(chosen)
			if (calendar && !calendar.readOnly) {
				return calendar
			}
		}
		const calendar = rootGetters.getCalendarByRoute(route)
		// In collections new tasks do not go into the template list
		const templateId = rootGetters.tbTemplateCalendar?.id
		if (!route.params.calendarId && calendar && templateId && calendar.id === templateId) {
			return rootGetters.getSortedWritableCalendars.find(other => other.id !== templateId && other.supportsTasks !== false) || calendar
		}
		return calendar
	},
}

/**
 * Vuex plugin: the list style is set on <body> (data-tb-list-style), the theme styles by it
 *
 * @param {object} store The Vuex store
 */
export function tbUiPlugin(store) {
	store.watch(
		() => store.getters.tbPrefs.listStyle,
		(style) => {
			document.body.dataset.tbListStyle = ['cards', 'rows', 'compact'].includes(style) ? style : 'cards'
		},
		{ immediate: true },
	)
}

const actions = {
	/**
	 * Ends waiting: removes the waiting tag and a start date in the future, keeps the status
	 *
	 * @param {object} context The store context
	 * @param {object} data Destructuring object
	 * @param {object} data.task The task
	 * @return {Promise}
	 */
	async tbStopWaiting(context, { task }) {
		if (isTaskReadOnly(task)) {
			return
		}
		let changed = false
		if (hasWaitingTag(task)) {
			context.commit('setTags', { task, tags: task.tags.filter(tag => !isWaitingTagName(tag)) })
			changed = true
		}
		if (startsInFuture(task)) {
			context.commit('setStart', { task, start: null })
			changed = true
		}
		if (changed) {
			await context.dispatch('updateTask', task)
		}
	},

	/**
	 * Sets a new follow-up date in some days (the task keeps waiting)
	 *
	 * @param {object} context The store context
	 * @param {object} data Destructuring object
	 * @param {object} data.task The task
	 * @param {number} data.days Days from today
	 * @return {Promise}
	 */
	async tbSnoozeFollowUp(context, { task, days }) {
		if (isTaskReadOnly(task)) {
			return
		}
		if (!hasWaitingTag(task)) {
			context.commit('setTags', { task, tags: task.tags.concat([waitingTag()]) })
		}
		context.commit('setStart', { task, start: moment().add(days, 'days').startOf('day'), allDay: true })
		await context.dispatch('updateTask', task)
	},

	/**
	 * Changes the view settings for one key and saves all of them
	 *
	 * @param {object} context The store context
	 * @param {object} data Destructuring object
	 * @param {string} data.key The view key (see viewKeyForRoute)
	 * @param {object} data.patch The changed settings
	 * @return {Promise}
	 */
	async setTbView(context, { key, patch }) {
		const views = patchViews(context.getters.tbViews, key, patch)
		context.commit('setSetting', { type: 'tbViews', value: views })
		await saveSetting('tbViews', views)
	},

	/**
	 * Changes the preferences of Tasks Board
	 *
	 * @param {object} context The store context
	 * @param {object} patch The changed preferences
	 * @return {Promise}
	 */
	/**
	 * Chooses the target list for new tasks of the current list or collection
	 *
	 * @param {object} context The store context
	 * @param {object} data Destructuring object
	 * @param {object} data.route The current route
	 * @param {string} data.calendarId The chosen list
	 * @return {Promise}
	 */
	async setTbTargetCalendar(context, { route, calendarId }) {
		const key = sortKeyForRoute(route)
		if (!key) {
			return
		}
		if (route.params.calendarId) {
			context.commit('setTbTargetOverride', { key, calendarId })
			return
		}
		await context.dispatch('setTbView', { key, patch: { targetCalendarId: calendarId } })
	},

	async setTbPrefs(context, patch) {
		const prefs = { ...context.getters.tbPrefs, ...patch }
		context.commit('setSetting', { type: 'tbPrefs', value: prefs })
		await saveSetting('tbPrefs', prefs)
	},

	/**
	 * Moves a task to another board column and changes its properties accordingly.
	 *
	 * - open:       status NEEDS-ACTION, 0 %
	 * - inProgress: status IN-PROCESS
	 * - waiting:    waiting tag + start date (follow-up) = waitUntil
	 * - done:       completed (subtasks are completed as well)
	 * - cancelled:  cancelled (open subtasks are cancelled as well)
	 *
	 * Leaving the waiting column removes the tag and a start date in the future.
	 *
	 * @param {object} context The store context
	 * @param {object} data Destructuring object
	 * @param {object} data.task The task
	 * @param {string} data.column The target column
	 * @param {Date|moment|null} data.waitUntil The follow-up date (only for "waiting")
	 */
	async moveTaskToBoardColumn(context, { task, column, waitUntil = null }) {
		const { commit, dispatch, getters } = context
		if (isTaskReadOnly(task)) {
			return
		}
		const now = moment()
		let changed = false

		const removeWaiting = () => {
			if (hasWaitingTag(task)) {
				commit('setTags', { task, tags: task.tags.filter(tag => !isWaitingTagName(tag)) })
				changed = true
			}
			if (startsInFuture(task, now)) {
				commit('setStart', { task, start: null })
				changed = true
			}
		}
		const reopen = () => {
			if (task.closed) {
				// Setting 0 % also sets the status to NEEDS-ACTION and removes COMPLETED
				commit('setComplete', { task, complete: 0 })
				changed = true
			}
		}
		const reopenParent = async () => {
			const parent = getters.getParentTask(task)
			if (parent && parent.closed) {
				await dispatch('setStatus', { task: parent, status: 'IN-PROCESS' })
			}
		}

		switch (column) {
		case 'open':
			removeWaiting()
			reopen()
			if (task.status !== 'NEEDS-ACTION' || task.complete !== 0) {
				commit('setComplete', { task, complete: 0 })
				changed = true
			}
			await reopenParent()
			break
		case 'inProgress':
			removeWaiting()
			reopen()
			if (task.status !== 'IN-PROCESS') {
				commit('setStatus', { task, status: 'IN-PROCESS' })
				changed = true
			}
			await reopenParent()
			break
		case 'waiting': {
			if (!waitUntil) {
				return
			}
			reopen()
			if (!hasWaitingTag(task)) {
				commit('setTags', { task, tags: task.tags.concat([waitingTag()]) })
			}
			commit('setStart', { task, start: moment(waitUntil).startOf('day'), allDay: true })
			changed = true
			await reopenParent()
			break
		}
		case 'done':
			removeWaiting()
			if (task.complete === 100 && !task.completed) {
				commit('setStatus', { task, status: 'COMPLETED' })
				changed = true
				break
			}
			// Completes subtasks and handles recurring tasks, saves the task.
			await dispatch('setPercentComplete', { task, complete: 100 })
			return
		case 'cancelled':
			removeWaiting()
			// Cancels open subtasks and saves the task.
			await dispatch('setStatus', { task, status: 'CANCELLED' })
			return
		default:
			return
		}
		if (changed) {
			await dispatch('updateTask', task)
		}
	},
}

export default { state, getters, mutations, actions }
