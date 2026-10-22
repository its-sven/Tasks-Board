/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Assignment of a task to one person.
 *
 * Stored as ATTENDEE of the VTODO, so other clients (Thunderbird, phones) see a
 * participant. The Nextcloud user id is kept in X-NC-USERID, the person who
 * assigned the task in X-TASKS-BOARD-ASSIGNED-BY. SCHEDULE-AGENT=CLIENT keeps the server
 * from sending invitations. Attendees without X-NC-USERID (from other clients)
 * are left untouched.
 */

import ICAL from 'ical.js'

export const USER_PARAM = 'x-nc-userid'
export const ASSIGNED_BY_PARAM = 'x-tasks-board-assigned-by'

/** Filter value for tasks without assignee */
export const UNASSIGNED = '__unassigned__'

/**
 * @param {string} value Value of the ATTENDEE property
 * @return {string} The e-mail address or ''
 */
function mailOf(value) {
	const match = /^mailto:(.+)$/i.exec(value || '')
	return match ? decodeURIComponent(match[1]) : ''
}

/**
 * Reads the assigned person of a task
 *
 * @param {ICAL.Component} vtodo The VTODO
 * @return {{uid: string, displayName: string, email: string, assignedBy: string}|null}
 */
export function readAssignee(vtodo) {
	if (!vtodo) {
		return null
	}
	for (const property of vtodo.getAllProperties('attendee')) {
		const uid = property.getParameter(USER_PARAM)
		if (uid) {
			return {
				uid: String(uid),
				displayName: String(property.getParameter('cn') || uid),
				email: mailOf(String(property.getFirstValue() || '')),
				assignedBy: String(property.getParameter(ASSIGNED_BY_PARAM) || ''),
			}
		}
	}
	return null
}

/**
 * Sets (or removes) the assigned person of a task
 *
 * @param {ICAL.Component} vtodo The VTODO
 * @param {{uid: string, displayName: string, email: string}|null} person The person, null to remove
 * @param {string} assignedBy User id of the person who assigns
 * @return {object|null} The assignee as readAssignee() returns it
 */
export function writeAssignee(vtodo, person, assignedBy) {
	for (const property of vtodo.getAllProperties('attendee')) {
		if (property.getParameter(USER_PARAM)) {
			vtodo.removeProperty(property)
		}
	}
	if (!person || !person.uid) {
		return null
	}
	const property = new ICAL.Property('attendee', vtodo)
	property.setValue(person.email ? 'mailto:' + person.email : 'urn:x-nextcloud:user:' + encodeURIComponent(person.uid))
	property.setParameter('cn', person.displayName || person.uid)
	property.setParameter('cutype', 'INDIVIDUAL')
	property.setParameter('role', 'REQ-PARTICIPANT')
	property.setParameter('partstat', 'NEEDS-ACTION')
	property.setParameter('schedule-agent', 'CLIENT')
	property.setParameter(USER_PARAM, person.uid)
	if (assignedBy) {
		property.setParameter(ASSIGNED_BY_PARAM, assignedBy)
	}
	vtodo.addProperty(property)
	return readAssignee(vtodo)
}

/**
 * The assigned person of a task model (kept in task._tbAssignee)
 *
 * @param {object} task The task
 * @return {object|null}
 */
export function assigneeOf(task) {
	return task?._tbAssignee || null
}

/**
 * Whether a task is assigned to a user
 *
 * @param {object} task The task
 * @param {string} uid The user id
 * @return {boolean}
 */
export function isAssignedTo(task, uid) {
	return !!uid && assigneeOf(task)?.uid === uid
}

/**
 * Whether a task matches the person filter (empty filter matches everything)
 *
 * @param {object} task The task
 * @param {object} filter The filter of the store ({ tags, tbAssignees })
 * @return {boolean}
 */
export function matchesAssigneeFilter(task, filter) {
	const wanted = filter?.tbAssignees || []
	if (!wanted.length) {
		return true
	}
	const assignee = assigneeOf(task)
	return wanted.some(uid => uid === UNASSIGNED ? !assignee : assignee?.uid === uid)
}

/**
 * Initials for an avatar fallback
 *
 * @param {string} name Display name
 * @return {string}
 */
export function initials(name) {
	const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
	if (!parts.length) {
		return '?'
	}
	return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

/**
 * The persons that appear as assignees in a set of tasks, sorted by name
 *
 * @param {Array} tasks The tasks
 * @return {Array} [{ uid, displayName }]
 */
export function peopleOf(tasks) {
	const people = new Map()
	for (const task of tasks) {
		const assignee = assigneeOf(task)
		if (assignee && !people.has(assignee.uid)) {
			people.set(assignee.uid, { uid: assignee.uid, displayName: assignee.displayName })
		}
	}
	return [...people.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
}
