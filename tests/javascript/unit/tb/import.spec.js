import { importMessage, splitTasks, uidOf } from '../../../../src/tb/import.js'

import { describe, expect, it } from 'vitest'

const FILE = [
	'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nextcloud//Export//EN',
	'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin',
	'BEGIN:STANDARD', 'DTSTART:19701025T030000', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD',
	'BEGIN:DAYLIGHT', 'DTSTART:19700329T020000', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
	'END:VTIMEZONE',
	'BEGIN:VTODO', 'UID:main', 'SUMMARY:Main task', 'CATEGORIES:Server,Kunde', 'X-APPLE-SORT-ORDER:5',
	'ATTENDEE;CN=Max;X-NC-USERID=max;X-TASKS-BOARD-ASSIGNED-BY=admin;SCHEDULE-AGENT=CLIENT:mailto:max@example.com',
	'DUE;TZID=Europe/Berlin:20261030T170000', 'END:VTODO',
	'BEGIN:VTODO', 'UID:sub', 'SUMMARY:Subtask', 'RELATED-TO:main', 'END:VTODO',
	'BEGIN:VTODO', 'SUMMARY:Without uid', 'END:VTODO',
	'BEGIN:VEVENT', 'UID:event', 'SUMMARY:Meeting', 'DTSTART:20261030T100000Z', 'END:VEVENT',
	'END:VCALENDAR', '',
].join('\r\n')

describe('import', () => {
	it('splits a file into one object per task and keeps everything', () => {
		const { tasks, other } = splitTasks(FILE)
		expect(other).toBe(1)
		expect(tasks.map(task => task.uid).slice(0, 2)).toEqual(['main', 'sub'])
		expect(tasks).toHaveLength(3)
		const main = tasks[0].ics
		expect(main).toContain('BEGIN:VTIMEZONE')
		expect(main).toContain('TZID:Europe/Berlin')
		expect(main).toContain('CATEGORIES:Server,Kunde')
		expect(main).toContain('X-APPLE-SORT-ORDER:5')
		expect(main).toContain('X-TASKS-BOARD-ASSIGNED-BY=admin')
		expect(main).not.toContain('VEVENT')
		// The subtask does not need the time zone
		expect(tasks[1].ics).not.toContain('VTIMEZONE')
		expect(tasks[1].ics).toContain('RELATED-TO:main')
		// A task without UID gets one
		expect(tasks[2].uid).toMatch(/[0-9a-f-]{36}/)
		expect(tasks[2].ics).toContain('UID:' + tasks[2].uid)
	})

	it('keeps changed occurrences of a repeating task together', () => {
		const text = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:x',
			'BEGIN:VTODO', 'UID:r', 'SUMMARY:Weekly', 'DTSTART:20261001T080000Z', 'RRULE:FREQ=WEEKLY', 'END:VTODO',
			'BEGIN:VTODO', 'UID:r', 'SUMMARY:Weekly (moved)', 'RECURRENCE-ID:20261008T080000Z', 'DTSTART:20261009T080000Z', 'END:VTODO',
			'END:VCALENDAR', ''].join('\r\n')
		const { tasks } = splitTasks(text)
		expect(tasks).toHaveLength(1)
		expect(tasks[0].ics.match(/BEGIN:VTODO/g)).toHaveLength(2)
	})

	it('summarizes the result', () => {
		const tbt = (text, vars = {}) => text.replace(/{(\w+)}/g, (m, key) => vars[key])
		expect(importMessage({ created: 3, existing: 1, failed: 0, other: 2 }, tbt)).toBe('Import: 3 imported, 1 already in the list, 2 other entries (e.g. events) ignored')
		expect(importMessage({ created: 0, existing: 0, failed: 0, other: 4 }, tbt)).toBe('The file contains no tasks.')
	})

	it('reads the UID of the task', () => {
		expect(uidOf('BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nSUMMARY:x\r\nUID:abc-\r\n 123\r\nBEGIN:VALARM\r\nUID:alarm\r\nEND:VALARM\r\nEND:VTODO\r\nEND:VCALENDAR')).toBe('abc-123')
		expect(uidOf('')).toBe(null)
	})
})
