/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

// Requests that are running, per list, so a list is never loaded twice at the same time
const running = new Map()

/**
 * Loads the completed tasks of the lists that do not have them yet
 *
 * @param {object} store The store
 * @param {Array} calendars The lists
 * @return {Promise}
 */
export function loadCompletedTasks(store, calendars) {
	return Promise.all(calendars
		.filter(calendar => calendar && !calendar.loadedCompleted)
		.map(calendar => {
			if (!running.has(calendar.id)) {
				const request = store.dispatch('getTasksFromCalendar', { calendar, completed: true, related: null })
					.finally(() => running.delete(calendar.id))
				running.set(calendar.id, request)
			}
			return running.get(calendar.id)
		}))
}
