/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Vuex module "tbTemplates": the template list and creating tasks from a template.
 */

import SyncStatus from '../../models/syncStatus.js'
import Task from '../../models/task.js'
import { randomUUID } from '../../utils/crypto.js'
import { assigneeOf } from '../assignee.js'
import { tbt } from '../l10n.js'
import { prepareTemplateCopy, resolveTemplateCalendar, setActiveTemplateId } from '../templates.js'
import { currentUid, requestNotification } from './assignment.js'

import ICAL from 'ical.js'

const getters = {
	/**
	 * The template list (or null)
	 *
	 * @param {object} state The module state
	 * @param {object} getters The store getters
	 * @return {object|null}
	 */
	tbTemplateCalendar: (state, getters) => resolveTemplateCalendar(getters.tbPrefs.templateCalendarId || '', getters.getSortedCalendars),
}

/**
 * Copies a task and its open subtasks into a list
 *
 * @param {object} context The store context
 * @param {object} data Destructuring object
 * @param {object} data.task The task to copy
 * @param {object} data.calendar The target list
 * @param {object|null} data.parent The new parent task
 * @param {string|null} data.summary New title (main task)
 * @param {Array} created Collects the created tasks
 */
async function copyTree(context, { task, calendar, parent, summary }, created) {
	const copy = new Task(ICAL.stringify(task.jCal), calendar)
	copy.uid = randomUUID()
	copy.created = ICAL.Time.fromJSDate(new Date(), true)
	copy.dav = null
	copy.conflict = false
	copy.related = parent ? parent.uid : null
	prepareTemplateCopy(copy, { summary })

	copy.dav = await calendar.dav.createVObject(ICAL.stringify(copy.jCal))
	copy.syncStatus = new SyncStatus('success', tbt('Created from the template.'))
	context.commit('appendTask', copy)
	context.commit('addTaskToCalendar', copy)
	context.commit('addTaskToParent', { task: copy, parent: parent ? context.getters.getTaskByUid(parent.uid) : null })
	created.push(copy)

	const subTasks = Object.values(task.subTasks || {})
		.filter(sub => sub.status !== 'CANCELLED' && !sub.deleted)
	for (const sub of subTasks) {
		await copyTree(context, { task: sub, calendar, parent: copy, summary: null }, created)
	}
}

const actions = {
	/**
	 * Creates a task with its subtasks from a template
	 *
	 * @param {object} context The store context
	 * @param {object} data Destructuring object
	 * @param {object} data.template The template (main task of the template list)
	 * @param {object} data.calendar The target list
	 * @param {string} data.summary Title of the new task
	 * @return {Promise<{task: object|null, count: number, error: string}>}
	 */
	async createFromTemplate(context, { template, calendar, summary }) {
		if (!template || !calendar || calendar.readOnly) {
			return { task: null, count: 0, error: 'list' }
		}
		// Like duplicating: private tasks do not go into lists of other people
		if (calendar.isSharedWithMe && template.class !== 'PUBLIC') {
			return { task: null, count: 0, error: 'private' }
		}
		const created = []
		try {
			await copyTree(context, { task: template, calendar, parent: null, summary }, created)
		} catch (error) {
			console.error('Could not create the task from the template', error)
			return { task: created[0] ? context.getters.getTaskByUid(created[0].uid) : null, count: created.length, error: 'save' }
		}
		// Persons assigned in the template get the usual notification
		const me = currentUid()
		for (const copy of created) {
			const task = context.getters.getTaskByUid(copy.uid) || copy
			const assignee = assigneeOf(task)
			if (assignee?.uid && assignee.uid !== me) {
				requestNotification('assigned', task)
			}
		}
		return { task: context.getters.getTaskByUid(created[0].uid) || created[0], count: created.length, error: '' }
	},

	/**
	 * Creates the template list ("Templates", in German "Vorlagen")
	 *
	 * @param {object} context The store context
	 * @return {Promise<object|null>} The new list
	 */
	async createTbTemplateList(context) {
		const calendar = await context.dispatch('appendCalendar', { displayName: tbt('Templates'), color: '#7b8794' })
		return calendar || null
	},
}

/**
 * Vuex plugin: keeps the id of the template list up to date for the
 * collection filter (storeHelper.isTaskInList).
 *
 * @param {object} store The Vuex store
 */
export function tbTemplatesPlugin(store) {
	store.watch(
		() => store.getters.tbTemplateCalendar?.id || null,
		(id) => setActiveTemplateId(id),
		{ immediate: true },
	)
}

export default { getters, actions }
