/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Waiting tasks and follow-ups (pure, no store).
 * A task waits if it has the waiting tag or starts after today.
 * The follow-up date is the start date (DTSTART).
 *
 * The waiting tag can be changed by administrators. Without a setting it is
 * "wartet" on German instances and "waiting" otherwise.
 */

import moment from '@nextcloud/moment'
import { ref } from 'vue'

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
 * State of the follow-up date of a waiting task
 *
 * @param {object} task The task
 * @param {moment} now The current time
 * @return {string|null} 'pending', 'reached', 'noDate' or null if the task is not waiting
 */
export function followUpState(task, now = moment()) {
	if (startsInFuture(task, now)) {
		return 'pending'
	}
	if (!hasWaitingTag(task)) {
		return null
	}
	return task.startMoment.isValid() ? 'reached' : 'noDate'
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
	if (hasWaitingTag(task) || startsInFuture(task, now)) {
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
