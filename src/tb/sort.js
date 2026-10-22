/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Sorting and grouping additions of Tasks Board (pure functions).
 */

import { sort as upstreamSort } from '../store/storeHelper.js'
import { assigneeOf } from './assignee.js'
import { boardColumn, isWaitingTagName, parentTask, priorityGroup } from './board.js'

import moment from '@nextcloud/moment'

/** Sort orders added by Tasks Board */
export const EXTRA_SORT_ORDERS = ['status', 'progress', 'assignee', 'calendar', 'parent']

/** Order of the status groups (same as the board columns, active work first) */
const STATUS_ORDER = ['inProgress', 'open', 'waiting', 'done', 'cancelled']

/** Possible groupings of the list view */
export const GROUPINGS = ['none', 'status', 'tag', 'priority', 'assignee']

/** Sort orders for subtasks; 'inherit' = same as the main tasks */
export const SUBTASK_ORDERS = ['inherit', 'manual', 'alphabetically', 'priority', 'status']

/**
 * @param {object} a Task
 * @param {object} b Task
 * @return {number}
 */
function byPriority(a, b) {
	// Priority 0 (none) last, 1 highest
	const pa = +a.priority || 10
	const pb = +b.priority || 10
	return pa - pb
}

/**
 * @param {object} a Task
 * @param {object} b Task
 * @return {number}
 */
function bySummary(a, b) {
	return a.summary.localeCompare(b.summary, undefined, { numeric: true })
}

/**
 * By assigned person (name), unassigned tasks last
 *
 * @param {object} a Task
 * @param {object} b Task
 * @return {number}
 */
function byAssignee(a, b) {
	const na = assigneeOf(a)?.displayName
	const nb = assigneeOf(b)?.displayName
	if (!na || !nb) {
		return (na ? 0 : 1) - (nb ? 0 : 1)
	}
	return na.localeCompare(nb)
}

/**
 * Sorts tasks. Handles the extra sort orders and delegates all others to upstream.
 *
 * @param {Array} tasks The tasks
 * @param {string} sortOrder The sort order
 * @param {boolean|number} sortDirection Reverse the order
 * @param {moment} now The current time
 * @return {Array} The sorted tasks (new array for the extra orders)
 */
export function sort(tasks, sortOrder = 'default', sortDirection = false, now = moment()) {
	let comparator
	switch (sortOrder) {
	case 'status':
		comparator = (a, b) => (STATUS_ORDER.indexOf(boardColumn(a, now)) - STATUS_ORDER.indexOf(boardColumn(b, now)))
			|| byPriority(a, b) || bySummary(a, b)
		break
	case 'progress':
		// Most advanced first
		comparator = (a, b) => ((b.completed ? 100 : b.complete) - (a.completed ? 100 : a.complete))
			|| byPriority(a, b) || bySummary(a, b)
		break
	case 'assignee':
		comparator = (a, b) => byAssignee(a, b) || byPriority(a, b) || bySummary(a, b)
		break
	case 'calendar':
		// By list name (table view)
		comparator = (a, b) => (a.calendar?.displayName || '').localeCompare(b.calendar?.displayName || '')
			|| byPriority(a, b) || bySummary(a, b)
		break
	case 'parent':
		// Subtasks below their main task (table view)
		comparator = (a, b) => {
			const pa = parentTask(a)
			const pb = parentTask(b)
			return (pa || a).summary.localeCompare((pb || b).summary, undefined, { numeric: true })
				|| (pa ? 1 : 0) - (pb ? 1 : 0)
				|| bySummary(a, b)
		}
		break
	default:
		return upstreamSort(tasks, sortOrder, sortDirection)
	}
	const sorted = [...tasks].sort(comparator)
	return sortDirection ? sorted.reverse() : sorted
}

/**
 * Groups tasks for the list view.
 *
 * @param {Array} tasks The (root) tasks
 * @param {string} grouping One of GROUPINGS
 * @param {moment} now The current time
 * @return {Array} Groups: { key, type, value, tasks[] } in display order (empty groups omitted)
 */
export function groupTasks(tasks, grouping, now = moment()) {
	if (grouping === 'status') {
		return STATUS_ORDER
			.map(column => ({ key: 'status-' + column, type: 'status', value: column, tasks: tasks.filter(task => boardColumn(task, now) === column) }))
			.filter(group => group.tasks.length)
	}
	if (grouping === 'priority') {
		return ['high', 'medium', 'low', 'none']
			.map(group => ({ key: 'priority-' + group, type: 'priority', value: group, tasks: tasks.filter(task => priorityGroup(task) === group) }))
			.filter(group => group.tasks.length)
	}
	if (grouping === 'assignee') {
		const byPerson = new Map()
		const unassigned = []
		for (const task of tasks) {
			const assignee = assigneeOf(task)
			if (!assignee) {
				unassigned.push(task)
				continue
			}
			if (!byPerson.has(assignee.uid)) {
				byPerson.set(assignee.uid, { key: 'assignee-' + assignee.uid, type: 'assignee', value: assignee.displayName, uid: assignee.uid, tasks: [] })
			}
			byPerson.get(assignee.uid).tasks.push(task)
		}
		const groups = [...byPerson.values()].sort((a, b) => a.value.localeCompare(b.value))
		if (unassigned.length) {
			groups.push({ key: 'assignee-none', type: 'assigneeNone', value: null, tasks: unassigned })
		}
		return groups
	}
	if (grouping === 'tag') {
		// A task with several tags shows up in each of its tags. The waiting tag is no category.
		const byTag = new Map()
		const untagged = []
		for (const task of tasks) {
			const tags = task.tags.filter(tag => !isWaitingTagName(tag))
			if (!tags.length) {
				untagged.push(task)
			}
			for (const tag of tags) {
				if (!byTag.has(tag)) {
					byTag.set(tag, [])
				}
				byTag.get(tag).push(task)
			}
		}
		const groups = [...byTag.keys()]
			.sort((a, b) => a.localeCompare(b))
			.map(tag => ({ key: 'tag-' + tag, type: 'tag', value: tag, tasks: byTag.get(tag) }))
		if (untagged.length) {
			groups.push({ key: 'tag-none', type: 'tagNone', value: null, tasks: untagged })
		}
		return groups
	}
	return [{ key: 'all', type: 'all', value: null, tasks }]
}

/**
 * Key under which list settings (sorting, grouping) of a route are stored.
 * Unlike the board, every collection can have its own sorting.
 *
 * @param {object} route The route
 * @return {string|null} The key
 */
export function sortKeyForRoute(route) {
	if (route.params.calendarId) {
		return 'calendar:' + route.params.calendarId
	}
	if (route.params.collectionId) {
		return 'collection:' + route.params.collectionId
	}
	return null
}
