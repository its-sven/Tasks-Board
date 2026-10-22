/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Automatic progress of main tasks and defaults for new tasks.
 */

import { assigneeOf, writeAssignee } from './assignee.js'
import { isWaitingTagName, waitingTag } from './waiting.js'

import moment from '@nextcloud/moment'
import ICAL from 'ical.js'

/** Default preferences (stored per user as JSON in "tbPrefs") */
export const DEFAULT_PREFS = Object.freeze({
	autoProgress: true,
	inheritFromParent: true,
	// Notifications (sent by the server, see AssignmentService.php)
	notifyAssigned: true,
	notifyCompleted: true,
	notifyFollowUp: true,
	notifyDue: true,
	// Template list: '' = the list named "Vorlagen" or "Templates", 'none' = no template list, otherwise the list id
	templateCalendarId: '',
	// View: list style 'cards', 'rows' or 'compact'
	listStyle: 'cards',
})

/**
 * @param {string|object} value Stored JSON or parsed object
 * @return {object} Preferences filled with defaults
 */
export function parsePrefs(value) {
	let parsed = value
	if (typeof value === 'string') {
		try {
			parsed = JSON.parse(value || '{}')
		} catch {
			parsed = {}
		}
	}
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		parsed = {}
	}
	return { ...DEFAULT_PREFS, ...parsed }
}

/**
 * Progress of a main task from its direct subtasks.
 * Cancelled subtasks don't count. If all are done the result is 99 %:
 * the main task stays open until somebody checks it off.
 *
 * @param {object} parent The main task
 * @return {number|null} Percent, or null if there are no active subtasks
 */
export function computeProgress(parent) {
	const active = Object.values(parent.subTasks || {}).filter(task => task.status !== 'CANCELLED')
	if (!active.length) {
		return null
	}
	const done = active.filter(task => task.completed).length
	if (done === active.length) {
		return 99
	}
	return Math.round(done / active.length * 100)
}

/**
 * Applies the progress to the main task without touching completion.
 * Sets "in progress" if there is progress and the task had no status or "needs action".
 *
 * @param {object} parent The main task
 * @param {number} percent The progress
 * @return {boolean} Whether something changed
 */
export function applyProgress(parent, percent) {
	let changed = false
	if (parent.complete !== percent) {
		// setComplete() only writes PERCENT-COMPLETE, unlike the "complete" setter
		parent.setComplete(percent)
		changed = true
	}
	if (percent > 0 && (parent.status === null || parent.status === 'NEEDS-ACTION')) {
		parent.setStatus('IN-PROCESS')
		changed = true
	}
	return changed
}

/**
 * Defaults for a task that is about to be created:
 * status "needs action"; subtasks take over priority and tags of the main task.
 *
 * @param {object} task The new task (not yet saved)
 * @param {object|null} parent The main task, if any
 * @param {object} prefs The user's preferences
 */
export function applyNewTaskDefaults(task, parent, prefs) {
	if (!task.status && !task.completed) {
		task.setStatus('NEEDS-ACTION')
	}
	if (!parent || !prefs.inheritFromParent) {
		return
	}
	if (!task.priority && parent.priority) {
		task.priority = parent.priority
	}
	const inherited = parent.tags.filter(tag => !isWaitingTagName(tag))
	const merged = [...new Set([...task.tags, ...inherited])]
	if (merged.length !== task.tags.length) {
		task.tags = merged
	}
	// The assigned person of the main task is responsible for the subtask as well
	const parentAssignee = assigneeOf(parent)
	if (parentAssignee && !assigneeOf(task)) {
		task._tbAssignee = writeAssignee(task.vtodo, parentAssignee, parentAssignee.assignedBy)
	}
}

/**
 * Marks a new task as waiting with a follow-up date
 *
 * @param {object} task The task
 * @param {number} days Follow-up in that many days (0 = today)
 */
export function setWaiting(task, days) {
	if (!task.tags.some(isWaitingTagName)) {
		task.tags = [...task.tags, waitingTag()]
	}
	task.start = ICAL.Time.fromDateString(moment().add(days, 'days').format('YYYY-MM-DD'))
}

/**
 * Hook called by createTask before the new task is saved
 *
 * @param {object} task The new task
 * @param {object} getters The store getters
 * @param {object} taskData The data passed to createTask
 *   (tbAssignee: person to assign, tbWaitDays: waiting with follow-up in that many days)
 */
export function tbBeforeCreateTask(task, getters, taskData = {}) {
	const parent = task.related ? getters.getParentTask(task) : null
	if (taskData.tbAssignee?.uid) {
		task._tbAssignee = writeAssignee(task.vtodo, taskData.tbAssignee, taskData.tbAssignee.assignedBy || '')
	}
	if (Number.isInteger(taskData.tbWaitDays)) {
		setWaiting(task, taskData.tbWaitDays)
	}
	applyNewTaskDefaults(task, parent, getters.tbPrefs || DEFAULT_PREFS)
	// Lets the progress plugin know that this subtask was created here (not loaded)
	task.tbCreated = true
}

/** Mutations after which the progress of the main task has to be checked */
const PROGRESS_MUTATIONS = ['setComplete', 'setStatus', 'setCompletedDate', 'deleteTaskFromParent', 'addTaskToParent']

/**
 * Vuex plugin: keeps the progress of main tasks up to date.
 * Only reacts to changes made in this app (not to loading tasks).
 *
 * @param {object} store The Vuex store
 */
export function tbProgressPlugin(store) {
	const pending = new Map()

	const recompute = async (parent) => {
		if (!parent || parent.closed || parent.calendar.readOnly) {
			return
		}
		if (!parent.loadedCompleted) {
			// Completed subtasks are loaded lazily, without them the progress would be wrong.
			await store.dispatch('getTasksFromCalendar', { calendar: parent.calendar, completed: true, related: parent.uid })
		}
		const percent = computeProgress(parent)
		if (percent === null) {
			return
		}
		if (applyProgress(parent, percent)) {
			await store.dispatch('updateTask', parent)
		}
	}

	const schedule = (parent) => {
		if (!parent || pending.has(parent.key)) {
			return
		}
		// Collect several mutations of one user action
		pending.set(parent.key, setTimeout(() => {
			pending.delete(parent.key)
			recompute(parent).catch(error => console.error('Could not update the progress', error))
		}, 50))
	}

	store.subscribe((mutation) => {
		if (!PROGRESS_MUTATIONS.includes(mutation.type) || !store.getters.tbPrefs.autoProgress) {
			return
		}
		const { task, parent } = mutation.payload || {}
		if (!task) {
			return
		}
		if (mutation.type === 'addTaskToParent') {
			// Linking also happens while loading; only react to tasks created here.
			if (task.tbCreated) {
				delete task.tbCreated
				schedule(parent)
			}
			return
		}
		if (mutation.type === 'deleteTaskFromParent') {
			schedule(parent)
			return
		}
		if (task.related) {
			schedule(store.getters.getParentTask(task))
		}
	})
}
