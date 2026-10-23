/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Import of tasks from an iCalendar file (.ics), for example the export of a
 * list. The tasks are taken over unchanged with all their properties
 * (assignment, tags, subtasks, order, reminders …). The UIDs stay the same,
 * so subtasks keep their main task; tasks whose UID is already in the list
 * are skipped.
 */

import { randomUUID } from '../utils/crypto.js'

import ICAL from 'ical.js'

const PRODID = '-//Tasks Board//Import//EN'

/**
 * All TZIDs used by the properties of a component and its subcomponents
 *
 * @param {ICAL.Component} component The component
 * @param {Set} result Collected TZIDs
 * @return {Set} The TZIDs
 */
function usedTimezones(component, result = new Set()) {
	for (const property of component.getAllProperties()) {
		const tzid = property.getParameter('tzid')
		if (tzid) {
			result.add(tzid)
		}
	}
	for (const sub of component.getAllSubcomponents()) {
		usedTimezones(sub, result)
	}
	return result
}

/**
 * Splits an iCalendar file into one calendar object per task
 *
 * @param {string} text The content of the file
 * @return {object} { tasks: [{ uid, ics }], other: number of other components (events, journals …) }
 */
export function splitTasks(text) {
	let parsed = ICAL.parse(text)
	// Several VCALENDARs in one file
	if (!Array.isArray(parsed[0])) {
		parsed = [parsed]
	}
	const groups = new Map()
	let other = 0
	for (const jCal of parsed) {
		const vcalendar = new ICAL.Component(jCal)
		if (vcalendar.name !== 'vcalendar') {
			continue
		}
		const timezones = new Map(vcalendar.getAllSubcomponents('vtimezone')
			.map(timezone => [timezone.getFirstPropertyValue('tzid'), timezone]))
		for (const component of vcalendar.getAllSubcomponents()) {
			if (component.name === 'vtimezone') {
				continue
			}
			if (component.name !== 'vtodo') {
				other++
				continue
			}
			let uid = component.getFirstPropertyValue('uid')
			if (!uid) {
				uid = randomUUID()
				component.addPropertyWithValue('uid', uid)
			}
			// A repeating task and its changed occurrences (RECURRENCE-ID) belong together
			if (!groups.has(uid)) {
				groups.set(uid, { uid, todos: [], timezones })
			}
			groups.get(uid).todos.push(component)
		}
	}
	const tasks = []
	for (const { uid, todos, timezones } of groups.values()) {
		const vcalendar = new ICAL.Component('vcalendar')
		vcalendar.addPropertyWithValue('version', '2.0')
		vcalendar.addPropertyWithValue('prodid', PRODID)
		const tzids = new Set()
		todos.forEach(todo => usedTimezones(todo, tzids))
		for (const tzid of tzids) {
			if (timezones.has(tzid)) {
				vcalendar.addSubcomponent(new ICAL.Component(JSON.parse(JSON.stringify(timezones.get(tzid).jCal))))
			}
		}
		todos.forEach(todo => vcalendar.addSubcomponent(new ICAL.Component(JSON.parse(JSON.stringify(todo.jCal)))))
		tasks.push({ uid, ics: vcalendar.toString() })
	}
	return { tasks, other }
}

/**
 * UID of the task in an iCalendar object
 *
 * @param {string} data The iCalendar data
 * @return {string|null} The UID
 */
export function uidOf(data) {
	const unfolded = (data || '').replace(/\r?\n[ \t]/g, '')
	// The UID of the VTODO, not of a reminder inside it
	const start = unfolded.search(/^BEGIN:VTODO/m)
	const match = /^UID:(.*)$/m.exec(start >= 0 ? unfolded.slice(start) : unfolded)
	return match ? match[1].trim() : null
}

/**
 * Short summary of an import
 *
 * @param {object} result { created, existing, failed, other }
 * @param {Function} tbt The translation function
 * @return {string} The message
 */
export function importMessage(result, tbt) {
	const { created = 0, existing = 0, failed = 0, other = 0 } = result
	if (!created && !existing && !failed) {
		return tbt('The file contains no tasks.')
	}
	const parts = [tbt('{count} imported', { count: created })]
	if (existing) {
		parts.push(tbt('{count} already in the list', { count: existing }))
	}
	if (failed) {
		parts.push(tbt('{count} failed', { count: failed }))
	}
	if (other) {
		parts.push(tbt('{count} other entries (e.g. events) ignored', { count: other }))
	}
	return tbt('Import:') + ' ' + parts.join(', ')
}

/**
 * Lets the person pick an .ics file and imports its tasks into a list
 *
 * @param {object} store The store
 * @param {object} calendar The list
 * @param {object} helpers Destructuring object
 * @param {Function} helpers.showSuccess Shows a success message
 * @param {Function} helpers.showError Shows an error message
 * @param {Function} helpers.tbt The translation function
 */
export function pickAndImport(store, calendar, { showSuccess, showError, tbt }) {
	const input = document.createElement('input')
	input.type = 'file'
	input.accept = '.ics,.ical,.ifb,.icalendar,text/calendar'
	input.style.display = 'none'
	input.addEventListener('change', async () => {
		const file = input.files?.[0]
		input.remove()
		if (!file) {
			return
		}
		let result
		try {
			const text = await file.text()
			result = await store.dispatch('tbImportTasks', { calendar, text })
		} catch (error) {
			console.error('Tasks Board: import failed', error)
			showError(tbt('The file could not be read. Is it an iCalendar file (.ics)?'))
			return
		}
		const message = importMessage(result, tbt)
		if (result.failed) {
			showError(message)
		} else {
			showSuccess(message)
		}
	})
	document.body.appendChild(input)
	input.click()
}
