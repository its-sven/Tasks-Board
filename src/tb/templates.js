/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Templates: a list (default: the list named "Vorlagen" or "Templates") holds tasks with
 * subtasks that are copied into another list. The template list is not part
 * of the collections (Today, All, Assigned to me, ...).
 */

import { ref } from 'vue'

/** Names of the list that is used when no template list was chosen */
export const TEMPLATE_LIST_NAMES = ['vorlagen', 'templates']

/** Setting value: no template list */
export const NO_TEMPLATE_LIST = 'none'

/** Id of the active template list (reactive, so lists update when it changes) */
const activeTemplateId = ref(null)

/**
 * Finds the template list
 *
 * @param {string} setting templateCalendarId from the preferences ('' = automatic, 'none' = none)
 * @param {Array} calendars All lists
 * @return {object|null} The list
 */
export function resolveTemplateCalendar(setting, calendars) {
	const lists = (calendars || []).filter(calendar => calendar && calendar.supportsTasks !== false)
	if (setting === NO_TEMPLATE_LIST) {
		return null
	}
	if (setting) {
		return lists.find(calendar => calendar.id === setting) || null
	}
	const byName = lists.filter(calendar => TEMPLATE_LIST_NAMES.includes((calendar.displayName || '').trim().toLowerCase()))
	// Own list first, then shared ones
	return byName.find(calendar => !calendar.isSharedWithMe) || byName[0] || null
}

/**
 * @param {string|null} id Id of the template list
 */
export function setActiveTemplateId(id) {
	activeTemplateId.value = id || null
}

/**
 * @return {string|null} Id of the template list
 */
export function getActiveTemplateId() {
	return activeTemplateId.value
}

/**
 * Whether a list is the template list
 *
 * @param {object} calendar The list
 * @return {boolean}
 */
export function isTemplateCalendar(calendar) {
	const id = activeTemplateId.value
	return !!id && !!calendar && calendar.id === id
}

/**
 * Templates to choose from: main tasks of the template list, sorted by name.
 * Checked off templates stay templates, cancelled ones are left out.
 *
 * @param {object|null} calendar The template list
 * @return {Array}
 */
export function templateTasks(calendar) {
	if (!calendar) {
		return []
	}
	return Object.values(calendar.tasks || {})
		.filter(task => !task.related && task.status !== 'CANCELLED' && !task.deleted)
		.sort((a, b) => (a.summary || '').localeCompare(b.summary || '', undefined, { sensitivity: 'base' }))
}

/**
 * Number of tasks a template creates (main task and open subtasks)
 *
 * @param {object} task The template
 * @return {number}
 */
export function templateSize(task) {
	let count = 1
	for (const sub of Object.values(task.subTasks || {})) {
		if (sub.status !== 'CANCELLED') {
			count += templateSize(sub)
		}
	}
	return count
}

/**
 * Prepares a copy of a template task: open again, new title for the main task
 *
 * @param {object} copy The copied task (not yet saved)
 * @param {object} options Destructuring object
 * @param {string|null} options.summary New title (only for the main task)
 */
export function prepareTemplateCopy(copy, { summary = null } = {}) {
	if (summary !== null && summary.trim() !== '') {
		copy.summary = summary.trim()
	}
	if (copy.complete !== 0 || copy.completed || copy.status === 'IN-PROCESS') {
		copy.complete = 0
	}
	if (copy.status === 'COMPLETED') {
		copy.status = 'NEEDS-ACTION'
	}
}
