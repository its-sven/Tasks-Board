/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Opening and closing subtasks: which subtasks the list and the table show
 * below a task, and which tasks of the current view have subtasks to open or
 * close (button "Open all" / "Close all" in the header).
 */

import { isParentInList, isTaskInList } from '../store/storeHelper.js'
import { CLOSED_COLLECTIONS, closedTaskInCollection, collectBoardTasks } from './board.js'
import { treeRows } from './table.js'

import { getCurrentUser } from '@nextcloud/auth'
import moment from '@nextcloud/moment'

/** Collections whose list rows only show the subtasks in the collection (like TaskBody.filteredSubtasks) */
const LIST_FILTERED_COLLECTIONS = ['today', 'week', 'starred', 'current']

/**
 * The main tasks of the list view (like General.vue and Week.vue)
 *
 * @param {Array} calendars The lists shown
 * @param {string|null} collectionId The collection, or null for a single list
 * @param {object} options Options
 * @param {boolean} options.showClosed Whether completed and cancelled tasks are shown
 * @param {moment} options.now The current time
 * @param {string} options.me User id of the current user
 * @return {Array} The tasks
 */
export function listRoots(calendars, collectionId, { showClosed = false, now = moment(), me = getCurrentUser()?.uid } = {}) {
	const roots = []
	for (const calendar of calendars) {
		for (const task of Object.values(calendar.tasks)) {
			if (task.related && isParentInList(task, calendar.tasks)) {
				continue
			}
			if (!collectionId) {
				if (showClosed || !task.closed) {
					roots.push(task)
				}
			} else if (isTaskInList(task, collectionId)
				|| (showClosed && task.closed && CLOSED_COLLECTIONS.includes(collectionId) && closedTaskInCollection(task, collectionId, now, me))) {
				roots.push(task)
			}
		}
	}
	return roots
}

/**
 * Which subtasks a list row shows below its task (like TaskBody.filteredSubtasks)
 *
 * @param {string|null} collectionId The collection, or null for a single list
 * @param {boolean} showClosed Whether completed and cancelled tasks are shown
 * @return {Function} (subtask, parent) => boolean
 */
export function listSubtaskFilter(collectionId, showClosed) {
	const collection = LIST_FILTERED_COLLECTIONS.includes(collectionId) ? collectionId : null
	return (task, parent) => {
		if (task.closed && (!showClosed || parent.hideCompletedSubtasks)) {
			return false
		}
		return !collection || isTaskInList(task, collection)
	}
}

/**
 * Which subtasks the table shows below a task: the same rules as for the main tasks
 *
 * @param {string|null} collectionId The collection, or null for a single list
 * @param {boolean} showClosed Whether completed and cancelled tasks are shown
 * @param {object} options Options
 * @param {moment} options.now The current time
 * @param {string} options.me User id of the current user
 * @return {Function} subtask => boolean
 */
export function tableSubtaskFilter(collectionId, showClosed, { now = moment(), me = getCurrentUser()?.uid } = {}) {
	return collectionId
		? task => (task.closed ? showClosed && closedTaskInCollection(task, collectionId, now, me) : isTaskInList(task, collectionId))
		: task => showClosed || !task.closed
}

/**
 * The tasks with shown subtasks below the given main tasks, over all levels
 *
 * @param {Array} roots The main tasks
 * @param {Function} include (subtask, parent) => whether the subtask is shown
 * @return {Array} The tasks
 */
export function foldableTasks(roots, include) {
	return treeRows(roots, { isExpanded: () => true, include })
		.filter(row => row.hasChildren)
		.map(row => row.task)
}

/**
 * The tasks of a view whose subtasks can be opened and closed
 *
 * @param {string} mode 'list' or 'table'
 * @param {Array} calendars The lists shown
 * @param {string|null} collectionId The collection, or null for a single list
 * @param {object} options Options
 * @param {boolean} options.showClosed Whether completed and cancelled tasks are shown
 * @param {moment} options.now The current time
 * @param {string} options.me User id of the current user
 * @return {Array} The tasks
 */
export function viewFoldableTasks(mode, calendars, collectionId, { showClosed = false, now = moment(), me = getCurrentUser()?.uid } = {}) {
	if (mode === 'table') {
		const roots = collectBoardTasks({ calendars, collectionId, cards: 'root', now, me })
			.filter(task => showClosed || !task.closed)
		return foldableTasks(roots, tableSubtaskFilter(collectionId, showClosed, { now, me }))
	}
	return foldableTasks(listRoots(calendars, collectionId, { showClosed, now, me }), listSubtaskFilter(collectionId, showClosed))
}
