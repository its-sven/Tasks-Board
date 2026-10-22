/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Vuex module "tbAssignment": who can be assigned per list, assigning tasks,
 * and the notifications after assigning or completing a task.
 */

import Requests from '../../services/requests.js'
import { assigneeOf, writeAssignee } from '../assignee.js'

import { getCurrentUser } from '@nextcloud/auth'
import { generateUrl } from '@nextcloud/router'

/* global appName */

/**
 * @return {string} User id of the current user ('' if unknown)
 */
export function currentUid() {
	return getCurrentUser()?.uid || ''
}

/**
 * The current user as a person to assign
 *
 * @param {object} getters The store getters (for the e-mail address)
 * @return {{uid: string, displayName: string, email: string, assignedBy: string}}
 */
export function currentPerson(getters) {
	const user = getCurrentUser()
	let email = ''
	try {
		email = getters?.getCurrentUserPrincipalEmail || ''
	} catch {
		email = ''
	}
	return { uid: user?.uid || '', displayName: user?.displayName || user?.uid || '', email, assignedBy: user?.uid || '' }
}

/**
 * Waits until a running save of the task has finished (max. 10 s)
 *
 * @param {object} task The task
 * @return {Promise}
 */
async function waitForSave(task) {
	for (let i = 0; i < 100 && (task.updateRunning || task.updateScheduled); i++) {
		await new Promise(resolve => setTimeout(resolve, 100))
	}
}

/**
 * Asks the server to send a notification. The server checks the stored task.
 *
 * @param {string} type assigned or completed
 * @param {object} task The task
 * @return {Promise<object|null>} The answer ({ sent, reason })
 */
export async function requestNotification(type, task) {
	try {
		await waitForSave(task)
		const response = await Requests.post(generateUrl('apps/' + appName + '/api/v1/board/notify'), {
			type,
			calendarId: task.calendar.id,
			taskUri: task.uri,
		})
		return response?.data?.data || null
	} catch (error) {
		console.error('Could not send the notification', error)
		return null
	}
}

const state = {
	/** Persons per list id: { loading, people } */
	assignees: {},
}

const getters = {
	/**
	 * Persons a task of the list can be assigned to
	 *
	 * @param {object} state The module state
	 * @return {Function} (calendarId) => Array
	 */
	tbAssigneesFor: (state) => (calendarId) => state.assignees[calendarId]?.people || [],
}

const mutations = {
	setTbAssignees(state, { calendarId, people, loading = false }) {
		state.assignees = { ...state.assignees, [calendarId]: { people, loading } }
	},

	/**
	 * Sets the assigned person of a task (without saving)
	 *
	 * @param {object} state The module state
	 * @param {object} data Destructuring object
	 * @param {object} data.task The task
	 * @param {object|null} data.person The person or null
	 * @param {string} data.assignedBy User id of the person who assigns
	 */
	tbSetAssignee(state, { task, person, assignedBy }) {
		task._tbAssignee = writeAssignee(task.vtodo, person, assignedBy)
		task.updateLastModified?.()
	},
}

const actions = {
	/**
	 * Loads who can be assigned in a list (once per list)
	 *
	 * @param {object} context The store context
	 * @param {object} data Destructuring object
	 * @param {object} data.calendar The list
	 * @param {boolean} data.force Load again
	 * @return {Promise<Array>}
	 */
	async loadTbAssignees(context, { calendar, force = false }) {
		const cached = context.state.assignees[calendar.id]
		if (cached && !force) {
			return cached.people
		}
		context.commit('setTbAssignees', { calendarId: calendar.id, people: cached?.people || [], loading: true })
		try {
			const response = await Requests.get(generateUrl('apps/' + appName + '/api/v1/board/assignees/{calendarId}', { calendarId: calendar.id }))
			const people = Array.isArray(response?.data?.data) ? response.data.data : []
			context.commit('setTbAssignees', { calendarId: calendar.id, people })
			return people
		} catch (error) {
			console.error('Could not load the persons of list ' + calendar.id, error)
			context.commit('setTbAssignees', { calendarId: calendar.id, people: [] })
			return []
		}
	},

	/**
	 * Assigns a task to a person (or removes the assignment), saves it and
	 * notifies the person.
	 *
	 * @param {object} context The store context
	 * @param {object} data Destructuring object
	 * @param {object} data.task The task
	 * @param {object|null} data.person { uid, displayName, email } or null
	 * @param {boolean} data.notify Send a notification
	 * @return {Promise}
	 */
	async setTbAssignee(context, { task, person, notify = true }) {
		const before = assigneeOf(task)
		if ((before?.uid || null) === (person?.uid || null)) {
			return
		}
		const me = currentUid()
		context.commit('tbSetAssignee', { task, person, assignedBy: me })
		await context.dispatch('updateTask', task)
		if (!notify) {
			return
		}
		// Also when the assignment was removed: the server removes outdated notifications
		if ((person && person.uid !== me) || (before && before.uid !== me)) {
			await requestNotification('assigned', task)
		}
	},
}

/** Mutations that complete a task */
const COMPLETING_MUTATIONS = ['setComplete', 'setStatus', 'setCompletedDate']

/**
 * Vuex plugin: when someone completes a task that another person assigned,
 * that person gets a notification (after the task was saved).
 *
 * @param {object} store The Vuex store
 */
export function tbAssignmentPlugin(store) {
	store.subscribe((mutation) => {
		const task = mutation.payload?.task
		if (!task || !COMPLETING_MUTATIONS.includes(mutation.type)) {
			return
		}
		task._tbCompletionPending = !!task.completed
	})
	store.subscribeAction({
		after: (action) => {
			if (action.type !== 'updateTask') {
				return
			}
			const task = action.payload
			if (!task || !task._tbCompletionPending) {
				return
			}
			task._tbCompletionPending = false
			const assignee = assigneeOf(task)
			if (!task.completed || !assignee?.assignedBy || assignee.assignedBy === currentUid()) {
				return
			}
			// Subtasks completed together with their main task: one notification for the main task is enough
			const parent = task.related ? store.getters.getParentTask(task) : null
			if (parent?.completed && assigneeOf(parent)?.assignedBy === assignee.assignedBy) {
				return
			}
			requestNotification('completed', task)
		},
	})
}

export default { state, getters, mutations, actions }
