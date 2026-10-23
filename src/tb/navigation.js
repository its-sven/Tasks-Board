/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Order of the dashboard and the collections in the navigation (per person).
 */

/** Id of the dashboard in the stored order */
export const DASHBOARD_ENTRY = 'dashboard'

/**
 * The entries in the stored order. Entries that are not stored yet (new
 * collections) come last in their default order, unknown ids are dropped.
 *
 * @param {string[]} ids Ids of the collections in the default order
 * @param {Array|undefined|null} stored The stored order
 * @return {string[]} The dashboard and the collections in order
 */
export function orderedEntries(ids, stored) {
	const all = [DASHBOARD_ENTRY, ...ids]
	if (!Array.isArray(stored) || !stored.length) {
		return all
	}
	const known = stored.filter((id, index) => all.includes(id) && stored.indexOf(id) === index)
	return [...known, ...all.filter(id => !known.includes(id))]
}

/**
 * @param {string[]} order The current order
 * @param {number} from Old position
 * @param {number} to New position
 * @return {string[]} The new order
 */
export function moveEntry(order, from, to) {
	const result = [...order]
	if (from < 0 || from >= result.length || to < 0 || to >= result.length || from === to) {
		return result
	}
	result.splice(to, 0, result.splice(from, 1)[0])
	return result
}
