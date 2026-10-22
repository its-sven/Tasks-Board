/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Keyboard shortcuts: which key does what, and when they are ignored.
 */

/** Selector of the task rows and cards that can be focused with the keyboard */
export const TASK_SELECTOR = '.task-item__body[data-task-key], .tb-card[data-task-key], .tb-table__row[data-task-key]'

/** Where typing or an open menu/dialog owns the keyboard */
const OWNER_SELECTOR = 'input, textarea, select, [contenteditable=""], [contenteditable=true], .v-popper__popper, .modal-mask, [role=dialog], [role=menu], [role=listbox]'

/**
 * Maps a key event to a shortcut action
 *
 * @param {KeyboardEvent} event The event
 * @param {object} context Destructuring object
 * @param {boolean} context.onTask Whether a task row/card has the focus
 * @return {string|null} newTask, next, previous, open, toggle, select, board, help or null
 */
export function shortcutAction(event, { onTask = false } = {}) {
	if (event.ctrlKey || event.metaKey || event.altKey) {
		return null
	}
	switch (event.key) {
	case 'n':
	case 'N':
		return event.shiftKey ? null : 'newTask'
	case 'j':
		return 'next'
	case 'k':
		return 'previous'
	case 'ArrowDown':
		return 'next'
	case 'ArrowUp':
		return 'previous'
	case 'Enter':
		return onTask ? 'open' : null
	case ' ':
		return onTask ? 'toggle' : null
	case 'x':
	case 'X':
		return onTask ? 'select' : null
	case 'b':
	case 'B':
		return event.shiftKey ? null : 'board'
	case '?':
		return 'help'
	default:
		return null
	}
}

/**
 * Whether the shortcuts are off for this event (typing, open menu or dialog)
 *
 * @param {KeyboardEvent} event The event
 * @param {Document} doc The document
 * @return {boolean}
 */
export function shortcutsBlocked(event, doc = document) {
	if (event.isComposing || (event.repeat && !['ArrowDown', 'ArrowUp', 'j', 'k'].includes(event.key))) {
		return true
	}
	const target = event.target
	if (target?.closest?.(OWNER_SELECTOR) || target?.isContentEditable) {
		return true
	}
	// An open dialog or menu anywhere on the page
	return !!doc.querySelector('.modal-mask, [role=dialog][aria-modal=true], .v-popper__popper--shown')
}

/**
 * The next view for the key B: list → board → table → list
 *
 * @param {string} mode The current view
 * @return {string}
 */
export function nextViewMode(mode) {
	return { list: 'board', board: 'table', table: 'list' }[mode] || 'list'
}

/**
 * Next element to focus in a list
 *
 * @param {number} current Index of the focused element (-1: none)
 * @param {number} count Number of elements
 * @param {number} step +1 or -1
 * @return {number} New index (-1 if there is nothing)
 */
export function moveIndex(current, count, step) {
	if (count <= 0) {
		return -1
	}
	if (current < 0) {
		return step > 0 ? 0 : count - 1
	}
	return Math.min(count - 1, Math.max(0, current + step))
}

/**
 * Shortcut overview (labels are translated in the component)
 */
export const SHORTCUTS = [
	{ keys: ['N'], label: 'New task' },
	{ keys: ['↓', 'J'], label: 'Next task' },
	{ keys: ['↑', 'K'], label: 'Previous task' },
	{ keys: ['Enter'], label: 'Open the task' },
	{ keys: ['Space'], label: 'Complete / reopen the task' },
	{ keys: ['X'], label: 'Select the task' },
	{ keys: ['Esc'], label: 'Clear the selection' },
	{ keys: ['B'], label: 'Switch between list, board and table' },
	{ keys: ['?'], label: 'Show the keyboard shortcuts' },
]
