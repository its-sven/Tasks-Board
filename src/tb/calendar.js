/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Address in Tasks Board for a task clicked in the Calendar app. The Calendar
 * app sends the last two parts of the task's DAV address: the list (its URI,
 * which is also the list id in Tasks Board) and the file of the task.
 *
 * @param {object} event The event of the Calendar app
 * @param {string} event.calendarId The URI of the list
 * @param {string} event.taskId The file name of the task
 * @return {string|null} The path below the web root, or null
 */
export function taskUrlFromCalendar({ calendarId, taskId } = {}) {
	if (typeof calendarId !== 'string' || typeof taskId !== 'string' || !calendarId || !taskId) {
		return null
	}
	return '/apps/tasks_board/calendars/' + encodeURIComponent(calendarId) + '/tasks/' + encodeURIComponent(taskId)
}
