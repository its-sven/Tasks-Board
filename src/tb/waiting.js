/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Waiting tasks and follow-ups (pure, no store).
 * A task waits if it has the waiting tag or (switchable) starts after today.
 *
 * The follow-up date is a reminder (VALARM) in the task, marked with
 * X-TASKS-BOARD-FOLLOW-UP, so start and due date stay the plan. Tasks without
 * this reminder (set before 1.4.0, or tagged in another app) keep the old
 * rule: their start date is the follow-up date.
 *
 * The waiting tag can be changed by administrators. Without a setting it is
 * "wartet" on German instances and "waiting" otherwise.
 */

import moment from '@nextcloud/moment'
import ICAL from 'ical.js'
import { ref, toRaw } from 'vue'

/** Marks the reminder that holds the follow-up date (lower case: ICAL.js compares names as stored) */
export const FOLLOW_UP_PROPERTY = 'x-tasks-board-follow-up'

/** Time of day of the follow-up reminder (local time) */
export const FOLLOW_UP_HOUR = 8

/** Longest allowed tag (same limit as the server) */
const MAX_TAG_LENGTH = 100

/**
 * Cleans a tag: no commas, single spaces, limited length
 *
 * @param {string} tag The tag
 * @return {string}
 */
export function normalizeWaitingTag(tag) {
	return String(tag ?? '').replace(/,/g, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TAG_LENGTH)
}

/**
 * @param {string} language Language code, e.g. de or en_GB
 * @return {string} The waiting tag that is used when none is set
 */
export function defaultWaitingTag(language = 'en') {
	return String(language).toLowerCase().startsWith('de') ? 'wartet' : 'waiting'
}

/** The waiting tag in use (reactive, so lists update when it changes) */
const currentWaitingTag = ref(defaultWaitingTag())

/**
 * @return {string} The waiting tag in use
 */
export function waitingTag() {
	return currentWaitingTag.value
}

/**
 * Sets the waiting tag in use
 *
 * @param {string} tag The tag (empty: keep the current one)
 */
export function setWaitingTag(tag) {
	const clean = normalizeWaitingTag(tag)
	if (clean) {
		currentWaitingTag.value = clean
	}
}

/** Whether a start date in the future makes a task wait (preference, reactive) */
const futureStartWaits = ref(true)

/**
 * @param {boolean} waits Whether a start date in the future makes a task wait
 */
export function setFutureStartWaits(waits) {
	futureStartWaits.value = waits !== false
}

/**
 * @param {string} tag The tag
 * @return {boolean} Whether this is the waiting tag (case-insensitive)
 */
export function isWaitingTagName(tag) {
	return String(tag).trim().toLowerCase() === currentWaitingTag.value.toLowerCase()
}

/**
 * @param {object} task The task
 * @return {boolean} Whether the task has the waiting tag
 */
export function hasWaitingTag(task) {
	return (task.tags || []).some(isWaitingTagName)
}

/**
 * @param {object} task The task
 * @param {moment} now The current time
 * @return {boolean} Whether the task starts after today
 */
export function startsInFuture(task, now = moment()) {
	return task.startMoment.isValid() && task.startMoment.isAfter(now, 'day')
}

/**
 * @param {object} task The task
 * @param {moment} now The current time
 * @return {boolean} Whether the task waits because it starts after today (and the setting is on)
 */
export function waitsForStart(task, now = moment()) {
	return futureStartWaits.value && startsInFuture(task, now)
}

/**
 * @param {object} alarm A VALARM (ICAL.js or calendar-js component, the latter upper-cases names itself)
 * @return {boolean} Whether it is the follow-up reminder
 */
export function isFollowUpAlarm(alarm) {
	return !!alarm && toRaw(alarm).hasProperty(FOLLOW_UP_PROPERTY)
}

/**
 * @param {object} task The task
 * @return {boolean} Whether the task has a follow-up reminder
 */
export function hasFollowUpAlarm(task) {
	return (task.alarms || []).some(isFollowUpAlarm)
}

/**
 * The day of the follow-up reminder
 *
 * @param {object} task The task
 * @return {moment|null} Start of that day (local time), null without a reminder
 */
export function followUpAlarmDate(task) {
	// task.alarms is reactive, the components inside are read without the proxy
	// (ICAL.js compares time zones by identity)
	for (const alarm of task.alarms || []) {
		if (!isFollowUpAlarm(alarm)) {
			continue
		}
		const trigger = toRaw(alarm).getFirstPropertyValue('trigger')
		if (trigger && typeof trigger.toJSDate === 'function') {
			const date = moment(trigger.toJSDate())
			if (date.isValid()) {
				return date.startOf('day')
			}
		}
	}
	return null
}

/**
 * The follow-up date: the follow-up reminder, otherwise (old rule) the start
 * date of a task that has the waiting tag or waits for its start
 *
 * @param {object} task The task
 * @param {moment} now The current time
 * @return {moment|null} Start of that day, null without a date
 */
export function followUpDate(task, now = moment()) {
	const alarmDate = followUpAlarmDate(task)
	if (alarmDate) {
		return alarmDate
	}
	if (task.startMoment.isValid() && (hasWaitingTag(task) || waitsForStart(task, now))) {
		return task.startMoment.clone().startOf('day')
	}
	return null
}

/**
 * Writes the follow-up reminder: removes the old one and adds a new one at
 * FOLLOW_UP_HOUR on the given day. Changes the task, so call it from a mutation.
 *
 * @param {object} task The task
 * @param {Date|moment|null} date The follow-up day (null: only remove)
 * @param {string} description Text of the reminder (shown by other apps)
 */
export function writeFollowUpAlarm(task, date, description) {
	const vtodo = toRaw(task).vtodo
	for (const alarm of vtodo.getAllSubcomponents('valarm')) {
		if (isFollowUpAlarm(alarm)) {
			vtodo.removeSubcomponent(alarm)
		}
	}
	if (date) {
		const when = moment(date).startOf('day').hour(FOLLOW_UP_HOUR)
		const alarm = new ICAL.Component('valarm')
		alarm.addPropertyWithValue('action', 'DISPLAY')
		alarm.addPropertyWithValue('description', description)
		// Absolute reminders are in UTC (RFC 5545)
		alarm.addPropertyWithValue('trigger', ICAL.Time.fromJSDate(when.toDate(), true))
		alarm.addPropertyWithValue(FOLLOW_UP_PROPERTY, '1')
		vtodo.addSubcomponent(alarm)
	}
	task.updateLastModified()
	task._alarms = task.getAlarms()
}

/**
 * State of the follow-up date of a waiting task
 *
 * @param {object} task The task
 * @param {moment} now The current time
 * @return {string|null} 'pending', 'reached', 'noDate' or null if the task is not waiting
 */
export function followUpState(task, now = moment()) {
	if (!hasWaitingTag(task)) {
		return waitsForStart(task, now) ? 'pending' : null
	}
	const date = followUpDate(task, now)
	if (!date) {
		return 'noDate'
	}
	return date.isAfter(now, 'day') ? 'pending' : 'reached'
}

/**
 * Returns the board column of a task
 *
 * @param {object} task The task
 * @param {moment} now The current time
 * @return {string} One of COLUMNS
 */
export function boardColumn(task, now = moment()) {
	if (task.status === 'CANCELLED') {
		return 'cancelled'
	}
	if (task.completed) {
		return 'done'
	}
	if (hasWaitingTag(task) || waitsForStart(task, now)) {
		return 'waiting'
	}
	if (task.status === 'IN-PROCESS' || task.complete > 0) {
		return 'inProgress'
	}
	return 'open'
}

/**
 * Whether a task belongs to the collection "Waiting"
 *
 * @param {object} task The task
 * @param {moment} now The current time
 * @return {boolean}
 */
export function isTaskWaiting(task, now = moment()) {
	return !task.closed && boardColumn(task, now) === 'waiting'
}

/**
 * Whether the follow-up of a waiting task is due (date reached or no date)
 *
 * @param {object} task The task
 * @param {moment} now The current time
 * @return {boolean}
 */
export function isFollowUpDue(task, now = moment()) {
	return !task.closed && ['reached', 'noDate'].includes(followUpState(task, now))
}
