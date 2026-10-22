/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Table view: the columns, their order and visibility (one setting for all
 * lists), and the sort order behind each column header.
 */

/**
 * All columns. `sort` is the sort order a click on the header sets (see sort.js).
 * `label` is translated in the component.
 */
export const TABLE_COLUMNS = Object.freeze([
	{ key: 'summary', label: 'Task', sort: 'alphabetically', visible: true, fixed: true },
	{ key: 'assignee', label: 'Assigned to', sort: 'assignee', visible: true },
	{ key: 'start', label: 'Start / follow-up', sort: 'start', visible: true },
	{ key: 'due', label: 'Due', sort: 'due', visible: true },
	{ key: 'calendar', label: 'List', sort: 'calendar', visible: true },
	{ key: 'parent', label: 'Main task', sort: 'parent', visible: false },
	{ key: 'status', label: 'Status', sort: 'status', visible: true },
	{ key: 'priority', label: 'Priority', sort: 'priority', visible: true },
	{ key: 'tags', label: 'Tags', sort: 'tags', visible: true },
	{ key: 'progress', label: 'Progress', sort: 'progress', visible: false },
	{ key: 'overview', label: 'Overview', sort: null, visible: true },
	{ key: 'created', label: 'Created', sort: 'created', visible: false },
	{ key: 'modified', label: 'Last modified', sort: 'modified', visible: false },
])

const BY_KEY = Object.fromEntries(TABLE_COLUMNS.map(column => [column.key, column]))

/**
 * Columns in the stored order with their visibility. Unknown entries are
 * dropped, new columns are added with their default. The task name stays first.
 *
 * @param {Array|undefined} stored [{ key, visible }] from the preferences
 * @return {Array} Columns ({ ...definition, visible })
 */
export function normalizeColumns(stored) {
	const seen = new Set()
	const result = []
	for (const entry of Array.isArray(stored) ? stored : []) {
		const definition = entry && BY_KEY[entry.key]
		if (!definition || seen.has(definition.key)) {
			continue
		}
		seen.add(definition.key)
		result.push({ ...definition, visible: definition.fixed ? true : entry.visible !== false })
	}
	for (const definition of TABLE_COLUMNS) {
		if (!seen.has(definition.key)) {
			result.push({ ...definition })
		}
	}
	const summary = result.findIndex(column => column.key === 'summary')
	if (summary > 0) {
		result.unshift(...result.splice(summary, 1))
	}
	return result
}

/**
 * The form stored in the preferences
 *
 * @param {Array} columns Columns
 * @return {Array<{key: string, visible: boolean}>}
 */
export function storableColumns(columns) {
	return columns.map(column => ({ key: column.key, visible: !!column.visible }))
}

/**
 * Moves a column (the task name stays first)
 *
 * @param {Array} columns Columns
 * @param {number} from Old position
 * @param {number} to New position
 * @return {Array} New column list
 */
export function moveColumn(columns, from, to) {
	if (from === to || from < 0 || from >= columns.length || columns[from].fixed) {
		return columns
	}
	const result = [...columns]
	const [moved] = result.splice(from, 1)
	result.splice(Math.max(1, Math.min(result.length, to)), 0, moved)
	return result
}

/**
 * Shows or hides a column
 *
 * @param {Array} columns Columns
 * @param {string} key The column
 * @param {boolean} visible Show it
 * @return {Array} New column list
 */
export function setColumnVisible(columns, key, visible) {
	return columns.map(column => column.key === key && !column.fixed ? { ...column, visible } : column)
}

/**
 * Columns shown in a view. The list column is left out in a single list,
 * where it would always show the same list.
 *
 * @param {Array} columns Columns
 * @param {boolean} singleList Whether one list is shown
 * @return {Array}
 */
export function shownColumns(columns, singleList) {
	return columns.filter(column => column.visible && !(singleList && column.key === 'calendar'))
}
