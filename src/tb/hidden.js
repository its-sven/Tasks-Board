/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Hidden lists: lists a person does not want to see, for example calendars
 * that can hold tasks but are only used for appointments. They are folded
 * away at the bottom of the navigation and left out of the collections, the
 * overview and the list pickers. Stored in the preferences of Tasks Board
 * (per person), the lists themselves do not change.
 */

import { ref } from 'vue'

/** Ids of the hidden lists (reactive, set from the preferences) */
const hidden = ref(new Set())

/**
 * @param {Array|undefined} ids The ids of the hidden lists
 */
export function setHiddenLists(ids) {
	hidden.value = new Set(Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && id) : [])
}

/**
 * @param {object|string|null} calendar The list or its id
 * @return {boolean} Whether the list is hidden
 */
export function isListHidden(calendar) {
	const id = typeof calendar === 'string' ? calendar : calendar?.id
	return !!id && hidden.value.has(id)
}

/**
 * The stored ids after hiding or showing a list
 *
 * @param {Array|undefined} ids The stored ids
 * @param {string} calendarId The list
 * @param {boolean} hide Hide (true) or show (false)
 * @return {string[]}
 */
export function hiddenListsAfter(ids, calendarId, hide) {
	const rest = (Array.isArray(ids) ? ids : []).filter(id => id !== calendarId)
	return hide ? [...rest, calendarId] : rest
}
