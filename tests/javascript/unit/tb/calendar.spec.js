/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { taskUrlFromCalendar } from '../../../../src/tb/calendar.js'

import { describe, expect, it } from 'vitest'

describe('calendar - click on a task in the Calendar app', () => {
	it('builds the address of the task in Tasks Board', () => {
		expect(taskUrlFromCalendar({ calendarId: 'personal', taskId: 'abc-123.ics' })).toBe('/apps/tasks_board/calendars/personal/tasks/abc-123.ics')
		expect(taskUrlFromCalendar({ calendarId: 'work_shared_by_max', taskId: 'a b.ics' })).toBe('/apps/tasks_board/calendars/work_shared_by_max/tasks/a%20b.ics')
	})

	it('ignores incomplete events', () => {
		expect(taskUrlFromCalendar({ calendarId: 'personal' })).toBeNull()
		expect(taskUrlFromCalendar({})).toBeNull()
		expect(taskUrlFromCalendar()).toBeNull()
	})
})
