import { moveColumn, normalizeColumns, setColumnVisible, shownColumns, storableColumns, TABLE_COLUMNS, treeRows } from '../../../../src/tb/table.js'
import { resolveDrag } from '../../../../src/tb/resize.js'
import { nextViewMode } from '../../../../src/tb/shortcuts.js'
import { sort } from '../../../../src/tb/sort.js'
import { link, makeCalendar, makeTask } from './helpers.js'

import moment from '@nextcloud/moment'
import { describe, expect, it } from 'vitest'

describe('table - columns', () => {
	it('uses the defaults without a setting', () => {
		const columns = normalizeColumns(undefined)
		expect(columns.map(column => column.key)).toEqual(TABLE_COLUMNS.map(column => column.key))
		expect(columns.find(column => column.key === 'parent').visible).toBe(false)
	})

	it('keeps the stored order, adds new columns, the task stays first', () => {
		const columns = normalizeColumns([{ key: 'due', visible: true }, { key: 'summary', visible: false }, { key: 'gone' }, { key: 'status', visible: false }])
		const stored = columns.map(column => column.key).filter(key => ['summary', 'due', 'status'].includes(key))
		expect(stored).toEqual(['summary', 'due', 'status'])
		expect(columns[0].key).toBe('summary')
		expect(columns[0].visible).toBe(true)
		expect(columns.find(column => column.key === 'status').visible).toBe(false)
		expect(columns).toHaveLength(TABLE_COLUMNS.length)
	})

	it('puts a new column next to the one it follows by default', () => {
		// Stored before the follow-up column existed, in a changed order
		const before = TABLE_COLUMNS.filter(column => column.key !== 'followUp').map(column => ({ key: column.key, visible: true }))
		before.push(before.splice(3, 1)[0])
		const keys = normalizeColumns(before).map(column => column.key)
		expect(keys[keys.indexOf('due') + 1]).toBe('followUp')
		expect(keys.at(-2)).toBe('due')
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

	it('B goes list → board → table → timeline → list', () => {
		expect(['list', 'board', 'table', 'timeline', 'x'].map(nextViewMode)).toEqual(['board', 'table', 'timeline', 'list', 'list'])
	})
})

describe('table - tree', () => {
	const build = () => {
		const cal = makeCalendar('t')
		const main = makeTask(cal, { uid: 'main', summary: 'Main' })
		const b = makeTask(cal, { uid: 'b', summary: 'B step', related: 'main' })
		const a = makeTask(cal, { uid: 'a', summary: 'A step', related: 'main', tags: ['Server'] })
		const a1 = makeTask(cal, { uid: 'a1', summary: 'A detail', related: 'a', tags: ['Kunde'] })
		const done = makeTask(cal, { uid: 'done', summary: 'C done', related: 'main', status: 'COMPLETED', percent: 100 })
		link(main, b)
		link(main, a)
		link(a, a1)
		link(main, done)
		const other = makeTask(cal, { uid: 'other', summary: 'Other' })
		return { main, a, b, a1, done, other }
	}
	const alpha = tasks => [...tasks].sort((x, y) => x.summary.localeCompare(y.summary))
	const shape = rows => rows.map(row => '  '.repeat(row.depth) + row.task.summary + (row.hasChildren ? (row.expanded ? ' v' : ' >') : '') + (row.context ? ' (context)' : ''))

	it('shows only main tasks while they are closed', () => {
		const { main, other } = build()
		const rows = treeRows([main, other], { isExpanded: () => false, order: alpha })
		expect(shape(rows)).toEqual(['Main >', 'Other'])
	})

	it('opens each level on its own and sorts the siblings', () => {
		const { main, other } = build()
		const open = new Set(['main'])
		const isExpanded = task => open.has(task.uid)
		const include = task => !task.closed
		expect(shape(treeRows([main, other], { isExpanded, include, order: alpha }))).toEqual(['Main v', '  A step >', '  B step', 'Other'])
		open.add('a')
		expect(shape(treeRows([main, other], { isExpanded, include, order: alpha }))).toEqual(['Main v', '  A step v', '    A detail', '  B step', 'Other'])
		// With closed tasks
		expect(shape(treeRows([main], { isExpanded, order: alpha }))).toEqual(['Main v', '  A step v', '    A detail', '  B step', '  C done'])
	})

	it('shows the way to the matches while filtering', () => {
		const { main, other } = build()
		const matches = task => task.tags.includes('Kunde')
		const rows = treeRows([main, other], { isExpanded: () => false, order: alpha, matches })
		expect(shape(rows)).toEqual(['Main v (context)', '  A step v (context)', '    A detail', 'Other (context)'])
	})

	it('survives RELATED-TO loops', () => {
		const { main, a1 } = build()
		link(a1, main)
		const rows = treeRows([main], { isExpanded: () => true, order: alpha })
		expect(shape(rows)).toEqual(['Main v', '  A step v', '    A detail', '  B step', '  C done'])
	})
})

describe('table - sorting by follow-up', () => {
	it('puts the earliest follow-up first and tasks that do not wait last', () => {
		const now = moment('2026-11-03T10:00:00')
		const cal = makeCalendar('sf')
		const late = makeTask(cal, { uid: 'late', tags: ['waiting'], followUp: moment('2026-11-20') })
		const early = makeTask(cal, { uid: 'early', tags: ['waiting'], followUp: moment('2026-11-06') })
		const none = makeTask(cal, { uid: 'none' })
		expect(sort([none, late, early], 'followUp', false, now).map(task => task.uid)).toEqual(['early', 'late', 'none'])
	})
})
