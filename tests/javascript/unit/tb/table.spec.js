import { moveColumn, normalizeColumns, setColumnVisible, shownColumns, storableColumns, TABLE_COLUMNS } from '../../../../src/tb/table.js'
import { resolveDrag } from '../../../../src/tb/resize.js'
import { nextViewMode } from '../../../../src/tb/shortcuts.js'
import { sort } from '../../../../src/tb/sort.js'
import { link, makeCalendar, makeTask } from './helpers.js'

import { describe, expect, it } from 'vitest'

describe('table - columns', () => {
	it('uses the defaults without a setting', () => {
		const columns = normalizeColumns(undefined)
		expect(columns.map(column => column.key)).toEqual(TABLE_COLUMNS.map(column => column.key))
		expect(columns.find(column => column.key === 'parent').visible).toBe(false)
	})

	it('keeps the stored order, adds new columns, the task stays first', () => {
		const columns = normalizeColumns([{ key: 'due', visible: true }, { key: 'summary', visible: false }, { key: 'gone' }, { key: 'status', visible: false }])
		expect(columns.slice(0, 3).map(column => column.key)).toEqual(['summary', 'due', 'status'])
		expect(columns[0].visible).toBe(true)
		expect(columns.find(column => column.key === 'status').visible).toBe(false)
		expect(columns).toHaveLength(TABLE_COLUMNS.length)
	})

	it('moves and hides columns', () => {
		const columns = normalizeColumns(undefined)
		const moved = moveColumn(columns, 3, 1)
		expect(moved[1].key).toBe('due')
		expect(moveColumn(columns, 0, 3)).toBe(columns)
		expect(moveColumn(columns, 2, 0)[0].key).toBe('summary')
		const hidden = setColumnVisible(columns, 'tags', false)
		expect(hidden.find(column => column.key === 'tags').visible).toBe(false)
		expect(setColumnVisible(columns, 'summary', false)[0].visible).toBe(true)
		expect(storableColumns(hidden).find(column => column.key === 'tags')).toEqual({ key: 'tags', visible: false })
	})

	it('leaves out the list column in a single list', () => {
		const columns = normalizeColumns(undefined)
		expect(shownColumns(columns, true).some(column => column.key === 'calendar')).toBe(false)
		expect(shownColumns(columns, false).some(column => column.key === 'calendar')).toBe(true)
	})
})

describe('table - sorting by list and main task', () => {
	it('sorts by list name and keeps subtasks below their main task', () => {
		const a = makeCalendar('a', { displayName: 'Backup' })
		const b = makeCalendar('b', { displayName: 'Allgemein' })
		const x = makeTask(a, { uid: 'x', summary: 'Zeta' })
		const y = makeTask(b, { uid: 'y', summary: 'Beta' })
		expect(sort([x, y], 'calendar')).toEqual([y, x])

		const main = makeTask(a, { uid: 'm', summary: 'Mitte' })
		const sub = makeTask(a, { uid: 'ms', summary: 'Aaa Schritt', related: 'm' })
		link(main, sub)
		const other = makeTask(a, { uid: 'o', summary: 'Nord' })
		expect(sort([sub, other, main], 'parent')).toEqual([main, sub, other])
	})
})

describe('resize and view switch', () => {
	it('keeps the width in its limits and closes when dragged very narrow', () => {
		const limits = { min: 200, max: 500, collapseBelow: 130 }
		expect(resolveDrag(320, limits)).toEqual({ width: 320, collapse: false })
		expect(resolveDrag(150, limits)).toEqual({ width: 200, collapse: false })
		expect(resolveDrag(100, limits)).toEqual({ width: 200, collapse: true })
		expect(resolveDrag(900, limits)).toEqual({ width: 500, collapse: false })
		expect(resolveDrag(300, { min: 300, max: 100, collapseBelow: 200 }).width).toBe(300)
	})

	it('B goes list → board → table → list', () => {
		expect(['list', 'board', 'table', 'x'].map(nextViewMode)).toEqual(['board', 'table', 'list', 'list'])
	})
})
