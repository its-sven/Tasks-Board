/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Loaded on the pages of the Calendar app (see BeforeTemplateRenderedListener):
 * a click on a task opens it in Tasks Board instead of the Tasks app.
 *
 * The Calendar app announces the click on the event bus and then opens the
 * Tasks app itself (or shows a hint if it is disabled). The address of
 * Tasks Board is set right after that, so it wins in both cases.
 */

import { taskUrlFromCalendar } from './tb/calendar.js'

import { subscribe } from '@nextcloud/event-bus'
import { generateUrl } from '@nextcloud/router'

subscribe('calendar:handle-todo-click', (event) => {
	const path = taskUrlFromCalendar(event)
	if (!path) {
		return
	}
	const url = generateUrl(path)
	// After the Calendar app has set its own address in the same click
	queueMicrotask(() => {
		window.location.href = url
	})
})
