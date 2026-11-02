/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Timeline view: main tasks (projects) and their subtasks as bars from the
 * start (DTSTART) to the due date (DUE). Pure helpers for the spans, the
 * visible range, the bar positions and dragging, so they can be unit tested.
 * All positions are in whole days.
 */

import moment from '@nextcloud/moment'

/** Width of one day in pixels per scale */
export const SCALES = Object.freeze({
	week: 44,
	month: 18,
	quarter: 7,
})

export const DEFAULT_SCALE = 'month'

/**
 * @param {moment} value A moment
 * @return {moment|null} A copy at the start of its day, null if invalid
 */
function day(value) {
	return value && value.isValid() ? value.clone().startOf('day') : null
}

/**
 * The days a task covers
 *
 * @param {object} task The task
 * @return {object|null} { start, end, milestone } (moments at the start of the day), null without dates
 */
export function taskSpan(task) {
	const start = day(task.startMoment)
	const due = day(task.dueMoment)
	if (start && due) {
		return { start: moment.min(start, due), end: moment.max(start, due), milestone: false }
	}
	if (start || due) {
		const only = start || due
		return { start: only, end: only.clone(), milestone: true }
	}
	return null
}

/**
 * The days covered by several spans together
 *
 * @param {Array} spans Spans (null entries are left out)
 * @return {object|null} { start, end }
 */
export function joinSpans(spans) {
	const valid = spans.filter(Boolean)
	if (!valid.length) {
		return null
	}
	return {
		start: moment.min(valid.map(span => span.start)).clone(),
		end: moment.max(valid.map(span => span.end)).clone(),
	}
}

/**
 * Span of a row: the own dates, or (for a task without dates) the span of
 * everything below it, marked as derived
 *
 * @param {object} task The task
 * @param {Function} descendants task => all tasks below it that are shown
 * @return {object|null} { start, end, milestone, derived }
 */
export function rowSpan(task, descendants) {
	const own = taskSpan(task)
	if (own) {
		return { ...own, derived: false }
	}
	const joined = joinSpans(descendants(task).map(taskSpan))
	return joined ? { ...joined, milestone: false, derived: true } : null
}

/**
 * Whether a subtask lies (partly) outside the days of the task above it
 *
 * @param {object|null} span The span of the subtask
 * @param {object|null} parentSpan The span of the task above
 * @return {boolean}
 */
export function outsideParent(span, parentSpan) {
	if (!span || !parentSpan || parentSpan.derived) {
		return false
	}
	return span.start.isBefore(parentSpan.start, 'day') || span.end.isAfter(parentSpan.end, 'day')
}

/**
 * The days shown: all spans and today, with some room before and after
 *
 * @param {Array} spans The spans of the rows
 * @param {moment} now Today
 * @param {object} options Options
 * @param {number} options.before Days before the first date
 * @param {number} options.after Days after the last date
 * @param {number} options.minDays At least this many days
 * @param {number} options.maxPast At most this many days before today (a date far away, e.g. a typo in the year, does not stretch the view)
 * @param {number} options.maxFuture At most this many days after today
 * @return {object} { start, days }
 */
export function visibleRange(spans, now, { before = 7, after = 14, minDays = 42, maxPast = 365, maxFuture = 730 } = {}) {
	const today = now.clone().startOf('day')
	const joined = joinSpans([...spans, { start: today, end: today }])
	const earliest = today.clone().subtract(maxPast, 'days')
	const latest = today.clone().add(maxFuture, 'days')
	const first = moment.max(joined.start, earliest)
	const last = moment.min(joined.end, latest)
	const start = first.clone().subtract(before, 'days').startOf('isoWeek')
	let days = last.diff(start, 'days') + 1 + after
	days = Math.max(days, minDays)
	return { start, days }
}

/**
 * Position of a bar, cut off at the edges of the days shown
 *
 * @param {object} span The span
 * @param {moment} rangeStart The first day shown
 * @param {number} dayWidth Pixels per day
 * @param {number} days Number of days shown (Infinity: no cut)
 * @return {object} { left, width, cutStart, cutEnd } in pixels
 */
export function barGeometry(span, rangeStart, dayWidth, days = Infinity) {
	let first = span.start.diff(rangeStart, 'days')
	let last = span.end.diff(rangeStart, 'days')
	const cutStart = first < 0
	const cutEnd = last > days - 1
	first = Math.min(Math.max(first, 0), days - 1)
	last = Math.min(Math.max(last, first), days - 1)
	return { left: first * dayWidth, width: (last - first + 1) * dayWidth, cutStart, cutEnd }
}

/**
 * Labels above the days: months, and below them days or weeks depending on the scale
 *
 * @param {moment} rangeStart The first day shown
 * @param {number} days Number of days shown
 * @param {string} scale 'week', 'month' or 'quarter'
 * @param {moment} now Today
 * @return {object} { months: [{ label, left, width }], ticks: [{ label, left, width, weekend, today }] }
 */
export function headerCells(rangeStart, days, scale, now = moment()) {
	const dayWidth = SCALES[scale] || SCALES[DEFAULT_SCALE]
	const months = []
	const ticks = []
	const today = now.clone().startOf('day')
	for (let i = 0; i < days; i++) {
		const date = rangeStart.clone().add(i, 'days')
		const last = months[months.length - 1]
		const monthLabel = date.format('MMMM YYYY')
		if (last && last.key === date.format('YYYY-MM')) {
			last.width += dayWidth
		} else {
			months.push({ key: date.format('YYYY-MM'), label: monthLabel, left: i * dayWidth, width: dayWidth })
		}
		if (scale === 'quarter') {
			if (date.isoWeekday() === 1 || i === 0) {
				ticks.push({ key: date.format('YYYY-MM-DD'), label: date.format('D.M.'), left: i * dayWidth, width: dayWidth, weekend: false, today: false })
			} else {
				ticks[ticks.length - 1].width += dayWidth
			}
		} else {
			ticks.push({
				key: date.format('YYYY-MM-DD'),
				label: scale === 'week' ? date.format('dd D') : date.format('D'),
				left: i * dayWidth,
				width: dayWidth,
				weekend: date.isoWeekday() > 5,
				today: date.isSame(today, 'day'),
			})
		}
	}
	return { months, ticks }
}

/**
 * Whole days for a drag distance
 *
 * @param {number} pixels The distance
 * @param {number} dayWidth Pixels per day
 * @return {number}
 */
export function dragDays(pixels, dayWidth) {
	// || 0: no -0
	return Math.round(pixels / dayWidth) || 0
}

/**
 * New dates after dragging
 *
 * @param {object} task The task
 * @param {number} days Days moved
 * @param {string} edge 'move' (whole bar), 'start' or 'end'
 * @return {object} { start, due } (moments or null where nothing changes)
 */
export function shiftedDates(task, days, edge = 'move') {
	const start = task.startMoment && task.startMoment.isValid() ? task.startMoment.clone() : null
	const due = task.dueMoment && task.dueMoment.isValid() ? task.dueMoment.clone() : null
	if (!days) {
		return { start: null, due: null }
	}
	if (edge === 'start') {
		// Only a due date: the bar gets a start
		const base = start || due
		const moved = base.clone().add(days, 'days')
		return { start: due && moved.isAfter(due, 'day') ? due.clone() : moved, due: null }
	}
	if (edge === 'end') {
		const base = due || start
		const moved = base.clone().add(days, 'days')
		return { start: null, due: start && moved.isBefore(start, 'day') ? start.clone() : moved }
	}
	return {
		start: start ? start.add(days, 'days') : null,
		due: due ? due.add(days, 'days') : null,
	}
}
