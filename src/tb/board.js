/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Pure helpers for the Kanban board (no store, no DOM), so they can be unit tested.
 */

import { isTaskInList, isParentInList, searchSubTasks, sort } from '../store/storeHelper.js'
import { assigneeOf, isAssignedTo } from './assignee.js'
import { isTemplateCalendar } from './templates.js'

import { getCurrentUser } from '@nextcloud/auth'

import moment from '@nextcloud/moment'

import { boardColumn, followUpState, hasWaitingTag, isWaitingTagName, setWaitingTag, startsInFuture, waitingTag } from './waiting.js'

// Kept here as well, other modules import them from board.js
export { boardColumn, followUpState, hasWaitingTag, isWaitingTagName, setWaitingTag, startsInFuture, waitingTag }

/** Columns in display order */
export const COLUMNS = ['open', 'inProgress', 'waiting', 'done', 'cancelled']

/** Collections that can be shown as a board */
export const BOARD_COLLECTIONS = ['all', 'current', 'starred', 'today', 'assigned']

/** In collections, the done/cancelled columns only show tasks closed within this many days */
export const RECENTLY_CLOSED_DAYS = 14

/** Number of done/cancelled cards shown before "show more" */
export const CLOSED_LIMIT = 20

export const DEFAULT_VIEW = Object.freeze({
	mode: 'list',
	cards: 'root',
	lanes: 'none',
	// Order of the cards: 'sort' (like the sort order) or 'manual' (dragged by hand)
	boardOrder: 'sort',
})

/**
 * Returns the moment a task was closed (completed or cancelled)
 *
 * @param {object} task The task
 * @return {moment} The moment (may be invalid)
 */
export function closedMoment(task) {
	if (task.completed && task.completedDateMoment.isValid()) {
		return task.completedDateMoment
	}
	return task.modifiedMoment
}

/**
 * Whether a closed task belongs to a collection board
 *
 * @param {object} task The task
 * @param {string} collectionId The collection
 * @param {moment} now The current time
 * @param {string} me User id of the current user
 * @return {boolean}
 */
export function closedTaskInCollection(task, collectionId, now, me) {
	// Like the open tasks: the template list stays out of the collections
	if (isTemplateCalendar(task.calendar)) {
		return false
	}
	const closed = closedMoment(task)
	if (!closed.isValid() || now.diff(closed, 'days', true) > RECENTLY_CLOSED_DAYS) {
		return false
	}
	if (collectionId === 'starred') {
		return task.priority > 0 && task.priority < 5
	}
	if (collectionId === 'assigned') {
		return isAssignedTo(task, me)
	}
	return true
}

/**
 * The closed main tasks of a list that belong to a collection (closed recently)
 *
 * @param {object} calendar The list
 * @param {string} collectionId The collection
 * @param {object} options Options
 * @param {moment} options.now The current time
 * @param {string} options.me User id of the current user
 * @return {Array} The tasks
 */
export function closedTasksOfCollection(calendar, collectionId, { now = moment(), me = getCurrentUser()?.uid } = {}) {
	return Object.values(calendar.tasks).filter(task => task.closed
		&& closedTaskInCollection(task, collectionId, now, me)
		&& (!task.related || !isParentInList(task, calendar.tasks)))
}

/**
 * Collects the tasks to show as cards
 *
 * @param {object} options Options
 * @param {Array} options.calendars The calendars to show
 * @param {string|null} options.collectionId The collection, or null for a single list
 * @param {string} options.cards 'root' (main tasks) or 'all' (incl. subtasks)
 * @param {string} options.searchQuery The current search query
 * @param {object} options.filter The current filter ({ tags: [], tbAssignees: [] })
 * @param {moment} options.now The current time
 * @param {string} options.me User id of the current user
 * @return {Array} The tasks
 */
export function collectBoardTasks({ calendars, collectionId = null, cards = 'root', searchQuery = '', filter = { tags: [] }, now = moment(), me = getCurrentUser()?.uid }) {
	const rootOnly = cards !== 'all'
	const filtering = isFiltering(searchQuery, filter)
	const result = []
	for (const calendar of calendars) {
		for (const task of Object.values(calendar.tasks)) {
			if (collectionId) {
				const inCollection = task.closed
					? closedTaskInCollection(task, collectionId, now, me)
					: isTaskInList(task, collectionId, rootOnly)
				if (!inCollection) {
					continue
				}
			}
			if (rootOnly && task.related && isParentInList(task, calendar.tasks)) {
				continue
			}
			if (filtering && !task.matches(searchQuery, filter) && !(rootOnly && searchSubTasks(task, searchQuery, filter))) {
				continue
			}
			result.push(task)
		}
	}
	return result
}

/**
 * Whether a search or a filter is active
 *
 * @param {string} searchQuery The search
 * @param {object} filter The filter (tags, persons)
 * @return {boolean}
 */
export function isFiltering(searchQuery, filter) {
	return !!searchQuery || (filter?.tags?.length > 0) || (filter?.tbAssignees?.length > 0)
}

/**
 * Returns the parent task (in the same list) or null
 *
 * @param {object} task The task
 * @return {object|null} The parent
 */
export function parentTask(task) {
	if (!task.related) {
		return null
	}
	return Object.values(task.calendar.tasks).find(search => search.uid === task.related) || null
}

/**
 * Priority group (1–4 important, 5 normal, 6–9 someday)
 *
 * @param {object} task The task
 * @return {string} 'high', 'medium', 'low' or 'none'
 */
export function priorityGroup(task) {
	const priority = +task.priority
	if (priority > 0 && priority < 5) {
		return 'high'
	}
	if (priority === 5) {
		return 'medium'
	}
	if (priority > 5) {
		return 'low'
	}
	return 'none'
}

const PRIORITY_LANES = ['high', 'medium', 'low', 'none']

/**
 * Sorts the cards of one column
 *
 * @param {string} column The column
 * @param {Array} tasks The tasks
 * @param {string} sortOrder The user's sort order
 * @param {boolean} sortDirection The user's sort direction
 * @param {Function} sortFn The sort function for open columns
 * @return {Array} The sorted tasks
 */
export function sortColumn(column, tasks, sortOrder = 'default', sortDirection = false, sortFn = sort) {
	if (column === 'done' || column === 'cancelled') {
		return [...tasks].sort((a, b) => closedMoment(b).valueOf() - closedMoment(a).valueOf())
	}
	if (column === 'waiting' && sortOrder !== 'manual') {
		// Earliest follow-up first, tasks without date last
		return [...tasks].sort((a, b) => {
			const aStart = a.startMoment.isValid() ? a.startMoment.valueOf() : Infinity
			const bStart = b.startMoment.isValid() ? b.startMoment.valueOf() : Infinity
			if (aStart !== bStart) {
				return aStart - bStart
			}
			return a.summary.localeCompare(b.summary)
		})
	}
	return sortFn([...tasks], sortOrder, sortDirection)
}

/**
 * Groups tasks into lanes and columns
 *
 * @param {Array} tasks The tasks
 * @param {object} options Options
 * @param {string} options.lanes 'none', 'calendar', 'parent', 'priority' or 'assignee'
 * @param {boolean} options.showCancelled Whether to show the cancelled column
 * @param {Array} options.calendars The calendars (for lane order)
 * @param {string} options.sortOrder The user's sort order
 * @param {boolean} options.sortDirection The user's sort direction
 * @param {Function} options.sortFn The sort function for open columns
 * @param {moment} options.now The current time
 * @return {Array} Lanes: { key, type, title?, color?, calendarId?, parentUid?, group?, columns: { [column]: tasks[] } }
 */
export function buildBoard(tasks, { lanes = 'none', showCancelled = false, calendars = [], sortOrder = 'default', sortDirection = false, sortFn = sort, now = moment() } = {}) {
	const columns = COLUMNS.filter(column => showCancelled || column !== 'cancelled')
	const laneMap = new Map()
	const getLane = (key, data) => {
		if (!laneMap.has(key)) {
			laneMap.set(key, { key, ...data, columns: Object.fromEntries(columns.map(column => [column, []])) })
		}
		return laneMap.get(key)
	}

	for (const task of tasks) {
		const column = boardColumn(task, now)
		if (!columns.includes(column)) {
			continue
		}
		let lane
		switch (lanes) {
		case 'calendar':
			lane = getLane('calendar-' + task.calendar.id, { type: 'calendar', title: task.calendar.displayName, color: task.calendar.color, calendarId: task.calendar.id })
			break
		case 'parent': {
			const parent = parentTask(task)
			lane = parent
				? getLane('parent-' + parent.uid, { type: 'parent', title: parent.summary, color: task.calendar.color, parentUid: parent.uid, calendarId: parent.calendar.id })
				: getLane('parent-none', { type: 'parentNone' })
			break
		}
		case 'priority': {
			const group = priorityGroup(task)
			lane = getLane('priority-' + group, { type: 'priority', group })
			break
		}
		case 'assignee': {
			const assignee = assigneeOf(task)
			lane = assignee
				? getLane('assignee-' + assignee.uid, { type: 'assignee', title: assignee.displayName, assignee: { uid: assignee.uid, displayName: assignee.displayName, email: assignee.email } })
				: getLane('assignee-none', { type: 'assigneeNone' })
			break
		}
		default:
			lane = getLane('all', { type: 'all' })
		}
		lane.columns[column].push(task)
	}

	let result = [...laneMap.values()]
	if (lanes === 'calendar') {
		const order = calendars.map(calendar => 'calendar-' + calendar.id)
		result.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
	} else if (lanes === 'priority') {
		result.sort((a, b) => PRIORITY_LANES.indexOf(a.group) - PRIORITY_LANES.indexOf(b.group))
	} else if (lanes === 'assignee') {
		result.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'assigneeNone' ? 1 : -1
			}
			return (a.title || '').localeCompare(b.title || '')
		})
	} else if (lanes === 'parent') {
		result.sort((a, b) => {
			if (a.type !== b.type) {
				return a.type === 'parentNone' ? 1 : -1
			}
			return (a.title || '').localeCompare(b.title || '')
		})
	}
	if (result.length === 0) {
		result = [getLane('all', { type: 'all' })]
	}
	for (const lane of result) {
		for (const column of columns) {
			lane.columns[column] = sortColumn(column, lane.columns[column], sortOrder, sortDirection, sortFn)
		}
	}
	return result
}

/**
 * Rows actually used: rows by main task only make sense if subtasks are shown as cards
 *
 * @param {object} view The view settings
 * @return {string} 'none', 'calendar', 'parent' or 'priority'
 */
export function effectiveLanes(view) {
	return view.lanes === 'parent' && view.cards !== 'all' ? 'none' : view.lanes
}

/** Columns whose cards can be put in order by hand (done/cancelled stay sorted by date) */
export const MANUAL_COLUMNS = ['open', 'inProgress', 'waiting']

/**
 * New sort orders after a card was put at a position by hand.
 * Like the manual order of the list: the moved task gets a value between its
 * neighbours, the following tasks are only changed if necessary.
 *
 * @param {Array} tasks Tasks of the column in their current order (with or without the moved task)
 * @param {object} task The moved task
 * @param {number} newIndex Its new position
 * @return {Array<{task: object, order: number}>} Changed sort orders
 */
export function manualOrderChanges(tasks, task, newIndex) {
	const list = tasks.filter(other => other !== task)
	const index = Math.max(0, Math.min(list.length, newIndex))
	list.splice(index, 0, task)
	const prev = list[index - 1]
	const next = list[index + 1]
	let order
	if (next && (!prev || next.sortOrder - 1 > prev.sortOrder)) {
		order = next.sortOrder - 1
	} else if (prev) {
		order = prev.sortOrder + 1
	} else {
		order = task.sortOrder
	}
	const orders = list.map(other => other === task ? Math.max(0, order) : other.sortOrder)
	for (let i = 1; i < orders.length; i++) {
		if (orders[i] <= orders[i - 1]) {
			orders[i] = orders[i - 1] + 1
		}
	}
	return list
		.map((other, i) => ({ task: other, order: orders[i] }))
		.filter(change => change.task.sortOrder !== change.order)
}

/** Columns in which new tasks can be added directly */
export const ADD_COLUMNS = ['open', 'inProgress', 'waiting']

/** Priority given to tasks added in a priority row */
const LANE_PRIORITY = { high: 1, medium: 5, low: 9 }

/**
 * Properties of a task added directly in a board row
 *
 * @param {object} lane The row (see buildBoard)
 * @return {{calendarId: (string|undefined), priority: (number|undefined), related: (string|undefined), assignee: (object|undefined)}}
 */
export function laneTaskDefaults(lane) {
	const defaults = {}
	if (lane.type === 'assignee' && lane.assignee) {
		defaults.assignee = lane.assignee
	}
	if (lane.calendarId) {
		defaults.calendarId = lane.calendarId
	}
	if (lane.type === 'parent' && lane.parentUid) {
		defaults.related = lane.parentUid
	}
	if (lane.type === 'priority' && LANE_PRIORITY[lane.group]) {
		defaults.priority = LANE_PRIORITY[lane.group]
	}
	return defaults
}

/**
 * Key under which the view settings of a route are stored
 *
 * @param {object} route The route
 * @return {string|null} The key or null if the route cannot be shown as a board
 */
export function viewKeyForRoute(route) {
	if (route.params.calendarId) {
		return 'calendar:' + route.params.calendarId
	}
	if (route.params.collectionId && BOARD_COLLECTIONS.includes(route.params.collectionId)) {
		return 'collection:' + route.params.collectionId
	}
	return null
}

/**
 * Parses the stored view settings
 *
 * @param {string|object} value The stored JSON (or already parsed object)
 * @return {object} The view settings by key
 */
export function parseViews(value) {
	if (value && typeof value === 'object') {
		return value
	}
	try {
		const parsed = JSON.parse(value || '{}')
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
	} catch {
		return {}
	}
}

/** Key for settings that apply to all lists and collections (board or list) */
export const GLOBAL_VIEW_KEY = '*'

/** Views of a list or collection */
export const VIEW_MODES = ['list', 'board', 'table']

/**
 * Returns the view settings for a key, filled with defaults.
 * Board or list is the same everywhere once chosen (global setting),
 * older per-list choices only count until then.
 *
 * @param {object} views All stored view settings
 * @param {string|null} key The key
 * @return {object} The view settings
 */
export function viewFor(views, key) {
	const view = { ...DEFAULT_VIEW, ...((key && views?.[key]) || {}) }
	const globalMode = views?.[GLOBAL_VIEW_KEY]?.mode
	if (VIEW_MODES.includes(globalMode)) {
		view.mode = globalMode
	}
	return view
}

/**
 * Applies a change of the view settings
 *
 * @param {object} views All stored view settings
 * @param {string} key The key of the current list or collection
 * @param {object} patch The changed settings (mode is stored globally)
 * @return {object} The new view settings
 */
export function patchViews(views, key, patch) {
	const { mode, ...rest } = patch
	const changed = { ...views }
	if (mode) {
		changed[GLOBAL_VIEW_KEY] = { ...(changed[GLOBAL_VIEW_KEY] || {}), mode }
	}
	if (key && Object.keys(rest).length) {
		changed[key] = { ...(changed[key] || {}), ...rest }
	}
	return changed
}
