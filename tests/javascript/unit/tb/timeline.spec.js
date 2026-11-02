/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { barGeometry, dragDays, headerCells, joinSpans, outsideParent, rowSpan, shiftedDates, taskSpan, visibleRange } from '../../../../src/tb/timeline.js'

import moment from '@nextcloud/moment'

import { describe, expect, it } from 'vitest'

import { link, makeCalendar, makeTask } from './helpers.js'

const m = value => moment(value)
const days = span => span && [span.start.format('YYYY-MM-DD'), span.end.format('YYYY-MM-DD')]

describe('timeline - spans', () => {
	const cal = makeCalendar('t')
	const both = makeTask(cal, { uid: 'both', start: m('2026-11-03'), due: m('2026-11-10') })
	const dueOnly = makeTask(cal, { uid: 'due', due: m('2026-11-12') })
	const none = makeTask(cal, { uid: 'none' })

	it('reads start and due, a single date is a milestone', () => {
		expect(days(taskSpan(both))).toEqual(['2026-11-03', '2026-11-10'])
		expect(taskSpan(both).milestone).toBe(false)
		expect(days(taskSpan(dueOnly))).toEqual(['2026-11-12', '2026-11-12'])
		expect(taskSpan(dueOnly).milestone).toBe(true)
		expect(taskSpan(none)).toBeNull()
	})

	it('takes the span of the subtasks for a project without dates', () => {
		const project = makeTask(cal, { uid: 'p' })
		link(project, both)
		link(project, dueOnly)
		const span = rowSpan(project, task => Object.values(task.subTasks))
		expect(days(span)).toEqual(['2026-11-03', '2026-11-12'])
		expect(span.derived).toBe(true)
		expect(rowSpan(both, () => []).derived).toBe(false)
		expect(rowSpan(none, () => [])).toBeNull()
		expect(joinSpans([null])).toBeNull()
	})

	it('marks subtasks outside their project', () => {
		const parent = { start: m('2026-11-03'), end: m('2026-11-10'), derived: false }
		expect(outsideParent(taskSpan(both), parent)).toBe(false)
		expect(outsideParent(taskSpan(dueOnly), parent)).toBe(true)
		expect(outsideParent(taskSpan(dueOnly), { ...parent, derived: true })).toBe(false)
		expect(outsideParent(null, parent)).toBe(false)
	})
})

describe('timeline - range and positions', () => {
	it('shows all dates and today with some room, from a Monday', () => {
		const spans = [{ start: m('2026-11-10'), end: m('2026-12-20') }]
		const range = visibleRange(spans, m('2026-11-02T12:00:00'), { before: 7, after: 14, minDays: 42 })
		expect(range.start.format('YYYY-MM-DD')).toBe('2026-10-26')
		expect(range.start.isoWeekday()).toBe(1)
		expect(range.days).toBe(m('2026-12-20').diff(range.start, 'days') + 1 + 14)
		expect(visibleRange([], m('2026-11-02')).days).toBe(42)
		// a date far away (typo in the year) does not stretch the view
		const far = visibleRange([{ start: m('2026-11-10'), end: m('2099-12-31') }], m('2026-11-02'))
		expect(far.days).toBeLessThan(800)
	})

	it('places bars on whole days', () => {
		const start = m('2026-11-02')
		expect(barGeometry({ start: m('2026-11-04'), end: m('2026-11-06') }, start, 18)).toMatchObject({ left: 36, width: 54 })
		expect(barGeometry({ start: m('2026-11-02'), end: m('2026-11-02') }, start, 44)).toEqual({ left: 0, width: 44, cutStart: false, cutEnd: false })
		// cut off at the edges
		expect(barGeometry({ start: m('2026-10-20'), end: m('2026-11-03') }, start, 10, 30)).toEqual({ left: 0, width: 20, cutStart: true, cutEnd: false })
		expect(barGeometry({ start: m('2026-11-20'), end: m('2099-12-31') }, start, 10, 30)).toEqual({ left: 180, width: 120, cutStart: false, cutEnd: true })
	})

	it('labels months, days and weeks', () => {
		const cells = headerCells(m('2026-10-26'), 14, 'month', m('2026-11-02'))
		expect(cells.months.map(month => [month.key, month.width / 18])).toEqual([['2026-10', 6], ['2026-11', 8]])
		expect(cells.ticks).toHaveLength(14)
		expect(cells.ticks.find(tick => tick.today).key).toBe('2026-11-02')
		expect(cells.ticks.filter(tick => tick.weekend)).toHaveLength(4)
		const quarter = headerCells(m('2026-10-26'), 14, 'quarter', m('2026-11-02'))
		expect(quarter.ticks.map(tick => tick.key)).toEqual(['2026-10-26', '2026-11-02'])
	})
})

describe('timeline - dragging', () => {
	const cal = makeCalendar('d')
	const task = makeTask(cal, { uid: 'drag', start: m('2026-11-03'), due: m('2026-11-10') })
	const dueOnly = makeTask(cal, { uid: 'dueonly', due: m('2026-11-12') })

	it('rounds the distance to whole days', () => {
		expect(dragDays(40, 18)).toBe(2)
		expect(dragDays(-8, 18)).toBe(0)
		expect(Object.is(dragDays(-8, 18), -0)).toBe(false)
		expect(dragDays(-30, 18)).toBe(-2)
	})

	it('moves the whole bar or one end', () => {
		const moved = shiftedDates(task, 3, 'move')
		expect([moved.start.format('YYYY-MM-DD'), moved.due.format('YYYY-MM-DD')]).toEqual(['2026-11-06', '2026-11-13'])
		expect(shiftedDates(task, 2, 'start').start.format('YYYY-MM-DD')).toBe('2026-11-05')
		expect(shiftedDates(task, 2, 'start').due).toBeNull()
		expect(shiftedDates(task, -2, 'end').due.format('YYYY-MM-DD')).toBe('2026-11-08')
		// the ends do not cross
		expect(shiftedDates(task, 20, 'start').start.format('YYYY-MM-DD')).toBe('2026-11-10')
		expect(shiftedDates(task, -20, 'end').due.format('YYYY-MM-DD')).toBe('2026-11-03')
		expect(shiftedDates(task, 0, 'move')).toEqual({ start: null, due: null })
		// a milestone gets a start when its start is dragged
		expect(shiftedDates(dueOnly, -3, 'start').start.format('YYYY-MM-DD')).toBe('2026-11-09')
		expect(shiftedDates(dueOnly, 1, 'move').start).toBeNull()
	})
})
