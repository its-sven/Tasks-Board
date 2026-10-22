/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Dashboard figures (pure functions): what is open, on whom, in which list
 * or project, what needs attention, and how it developed over the weeks.
 *
 * "Project" = main task (a task without a parent that has subtasks).
 */

import { assigneeOf } from './assignee.js'
import { boardColumn, isWaitingTagName, priorityGroup } from './board.js'
import { isFollowUpDue } from './waiting.js'

import moment from '@nextcloud/moment'

/** Work states of open tasks, in the order of the charts */
export const WORK_STATES = ['inProgress', 'waiting', 'open', 'overdue']

/** Unassigned in the person filter */
export const NOBODY = '__nobody__'

/** Main tasks that are left alone this long count as "lying around" */
export const STALE_DAYS = 14

/**
 * Work state of a task: done, cancelled, overdue (open and due before today),
 * waiting, inProgress or open
 *
 * @param {object} task The task
 * @param {moment} now The current time
 * @return {string}
 */
export function workState(task, now = moment()) {
	const column = boardColumn(task, now)
	if (column === 'done' || column === 'cancelled') {
		return column
	}
	if (task.dueMoment?.isValid() && task.dueMoment.isBefore(now, 'day')) {
		return 'overdue'
	}
	return column
}

/**
 * @param {object} task The task
 * @return {object|null} The parent in the same list
 */
function parentOf(task) {
	if (!task.related) {
		return null
	}
	return Object.values(task.calendar.tasks || {}).find(other => other.uid === task.related) || null
}

/**
 * The main task at the top of a task's tree (the task itself for main tasks)
 *
 * @param {object} task The task
 * @return {object}
 */
export function rootOf(task) {
	let current = task
	const seen = new Set()
	for (let parent = parentOf(current); parent && !seen.has(parent.key); parent = parentOf(current)) {
		seen.add(current.key)
		current = parent
	}
	return current
}

/**
 * The project of a task: its main task, if that has subtasks
 *
 * @param {object} task The task
 * @return {object|null}
 */
export function projectOf(task) {
	const root = rootOf(task)
	return Object.keys(root.subTasks || {}).length ? root : null
}

/**
 * All tasks of the lists, without the template list
 *
 * @param {Array} calendars The lists
 * @param {string|null} templateId Id of the template list
 * @return {Array}
 */
export function dashboardTasks(calendars, templateId = null) {
	const tasks = []
	for (const calendar of calendars) {
		if (calendar.id === templateId || calendar.supportsTasks === false) {
			continue
		}
		for (const task of Object.values(calendar.tasks || {})) {
			if (!task.deleted) {
				tasks.push(task)
			}
		}
	}
	return tasks
}

/**
 * Projects to choose from in the filter: main tasks with subtasks
 *
 * @param {Array} tasks The tasks
 * @return {Array}
 */
export function projectOptions(tasks) {
	return tasks
		.filter(task => !parentOf(task) && Object.keys(task.subTasks || {}).length && task.status !== 'CANCELLED')
		.sort((a, b) => a.summary.localeCompare(b.summary, undefined, { numeric: true }))
}

/**
 * Applies the dashboard filters
 *
 * @param {Array} tasks The tasks
 * @param {object} filters Destructuring object
 * @param {string[]} filters.calendars List ids (empty: all)
 * @param {string|null} filters.project Key of a main task
 * @param {string[]} filters.people User ids, NOBODY for unassigned (empty: all)
 * @param {string[]} filters.tags Tags (empty: all)
 * @param {boolean} filters.rootOnly Count main tasks only
 * @return {Array}
 */
export function filterTasks(tasks, { calendars = [], project = null, people = [], tags = [], rootOnly = false } = {}) {
	const tagKeys = tags.map(tag => tag.toLowerCase())
	return tasks.filter(task => {
		if (calendars.length && !calendars.includes(task.calendar.id)) {
			return false
		}
		if (project && rootOf(task).key !== project) {
			return false
		}
		if (people.length && !people.includes(assigneeOf(task)?.uid || NOBODY)) {
			return false
		}
		if (tagKeys.length && !task.tags.some(tag => tagKeys.includes(tag.toLowerCase()))) {
			return false
		}
		if (rootOnly && parentOf(task)) {
			return false
		}
		return true
	})
}

/**
 * Counts per work state
 *
 * @param {Array} tasks The tasks
 * @param {moment} now The current time
 * @return {object} { inProgress, waiting, open, overdue, done, cancelled }
 */
export function countStates(tasks, now = moment()) {
	const counts = { inProgress: 0, waiting: 0, open: 0, overdue: 0, done: 0, cancelled: 0 }
	for (const task of tasks) {
		counts[workState(task, now)]++
	}
	return counts
}

/**
 * Headline numbers
 *
 * @param {Array} tasks The tasks
 * @param {moment} now The current time
 * @return {object}
 */
export function summary(tasks, now = moment()) {
	const counts = countStates(tasks, now)
	const weekStart = now.clone().startOf('isoWeek')
	const monthAgo = now.clone().subtract(30, 'days').startOf('day')
	let doneThisWeek = 0
	let done30 = 0
	let followUps = 0
	let unassigned = 0
	for (const task of tasks) {
		if (task.completed) {
			const completed = task.completedDateMoment
			if (completed?.isValid()) {
				if (!completed.isBefore(weekStart)) {
					doneThisWeek++
				}
				if (!completed.isBefore(monthAgo)) {
					done30++
				}
			}
			continue
		}
		if (task.closed) {
			continue
		}
		if (isFollowUpDue(task, now)) {
			followUps++
		}
		if (!assigneeOf(task)) {
			unassigned++
		}
	}
	return {
		...counts,
		remaining: counts.inProgress + counts.waiting + counts.open + counts.overdue,
		doneThisWeek,
		done30,
		followUps,
		unassigned,
	}
}

/**
 * Open tasks grouped by a dimension, counted per work state
 *
 * @param {Array} tasks The tasks
 * @param {string} dimension person, calendar, project, priority or tag
 * @param {object} options Destructuring object
 * @param {moment} options.now The current time
 * @param {number} options.limit Groups shown, the rest is folded into "other"
 * @return {Array<{key: string, label: string, color: (string|null), counts: object, total: number}>}
 */
export function breakdown(tasks, dimension, { now = moment(), limit = 8 } = {}) {
	const groups = new Map()
	const add = (key, label, color, state) => {
		if (!groups.has(key)) {
			groups.set(key, { key, label, color, counts: { inProgress: 0, waiting: 0, open: 0, overdue: 0 }, total: 0 })
		}
		const group = groups.get(key)
		group.counts[state]++
		group.total++
	}
	for (const task of tasks) {
		const state = workState(task, now)
		if (!WORK_STATES.includes(state)) {
			continue
		}
		switch (dimension) {
		case 'person': {
			const person = assigneeOf(task)
			add(person ? 'user:' + person.uid : NOBODY, person ? person.displayName || person.uid : null, null, state)
			break
		}
		case 'calendar':
			add('calendar:' + task.calendar.id, task.calendar.displayName, task.calendar.color || null, state)
			break
		case 'project': {
			const project = projectOf(task)
			add(project ? 'project:' + project.key : '__single__', project ? project.summary : null, project ? project.calendar.color : null, state)
			break
		}
		case 'priority': {
			const group = priorityGroup(task)
			add('priority:' + group, group, null, state)
			break
		}
		case 'tag': {
			const tags = task.tags.filter(tag => !isWaitingTagName(tag))
			if (!tags.length) {
				add('__notag__', null, null, state)
			}
			for (const tag of tags) {
				add('tag:' + tag.toLowerCase(), tag, null, state)
			}
			break
		}
		}
	}
	let result = [...groups.values()]
	if (dimension === 'priority') {
		const order = ['high', 'medium', 'low', 'none']
		return result.sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label))
	}
	// Biggest first; "nobody", "single tasks" and "no tag" last
	const special = (group) => group.label === null ? 1 : 0
	result = result.sort((a, b) => special(a) - special(b) || b.total - a.total || String(a.label).localeCompare(String(b.label)))
	if (result.length > limit) {
		const kept = result.slice(0, limit - 1)
		const other = { key: '__other__', label: null, color: null, counts: { inProgress: 0, waiting: 0, open: 0, overdue: 0 }, total: 0, other: result.length - kept.length }
		for (const group of result.slice(limit - 1)) {
			for (const state of WORK_STATES) {
				other.counts[state] += group.counts[state]
			}
			other.total += group.total
		}
		result = [...kept, other]
	}
	return result
}

/**
 * Tasks that need attention
 *
 * @param {Array} tasks The tasks
 * @param {moment} now The current time
 * @return {{overdue: Array, followUps: Array, unassigned: Array, stale: Array}}
 */
export function attention(tasks, now = moment()) {
	const open = tasks.filter(task => !task.closed)
	const staleBefore = now.clone().subtract(STALE_DAYS, 'days')
	const byPriority = (a, b) => (+a.priority || 10) - (+b.priority || 10) || a.summary.localeCompare(b.summary)
	return {
		overdue: open.filter(task => workState(task, now) === 'overdue')
			.sort((a, b) => a.dueMoment.valueOf() - b.dueMoment.valueOf()),
		followUps: open.filter(task => isFollowUpDue(task, now))
			.sort((a, b) => (a.startMoment.isValid() ? a.startMoment.valueOf() : 0) - (b.startMoment.isValid() ? b.startMoment.valueOf() : 0)),
		unassigned: open.filter(task => !assigneeOf(task) && workState(task, now) !== 'waiting')
			.sort(byPriority),
		stale: open.filter(task => priorityGroup(task) === 'high'
			&& workState(task, now) !== 'waiting'
			&& task.modifiedMoment?.isValid() && task.modifiedMoment.isBefore(staleBefore))
			.sort((a, b) => a.modifiedMoment.valueOf() - b.modifiedMoment.valueOf()),
	}
}

/**
 * New and completed tasks per week
 *
 * @param {Array} tasks The tasks
 * @param {object} options Destructuring object
 * @param {moment} options.now The current time
 * @param {number} options.weeks Number of weeks (the current one is the last)
 * @return {Array<{start: moment, week: number, created: number, completed: number}>}
 */
export function weeklyHistory(tasks, { now = moment(), weeks = 12 } = {}) {
	const first = now.clone().startOf('isoWeek').subtract(weeks - 1, 'weeks')
	const result = []
	for (let i = 0; i < weeks; i++) {
		const start = first.clone().add(i, 'weeks')
		result.push({ start, week: start.isoWeek(), created: 0, completed: 0 })
	}
	const index = (value) => {
		if (!value?.isValid() || value.isBefore(first)) {
			return -1
		}
		const position = Math.floor(value.clone().startOf('isoWeek').diff(first, 'days') / 7)
		return position < weeks ? position : -1
	}
	for (const task of tasks) {
		const created = index(task.createdMoment)
		if (created > -1) {
			result[created].created++
		}
		if (task.completed) {
			const completed = index(task.completedDateMoment)
			if (completed > -1) {
				result[completed].completed++
			}
		}
	}
	return result
}

/**
 * A clean upper end for an axis (1, 2, 5, 10, 20, 50 …)
 *
 * @param {number} value Largest value
 * @return {number}
 */
export function niceMax(value) {
	if (value <= 5) {
		return 5
	}
	const power = Math.pow(10, Math.floor(Math.log10(value)))
	for (const step of [1, 2, 2.5, 5, 10]) {
		if (value <= step * power) {
			return step * power
		}
	}
	return 10 * power
}
