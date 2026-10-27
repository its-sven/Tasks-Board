/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { foldableTasks, listRoots, listSubtaskFilter, tableSubtaskFilter, viewFoldableTasks } from '../../../../src/tb/fold.js'

import moment from '@nextcloud/moment'

import { describe, expect, it } from 'vitest'

import { link, makeCalendar, makeTask } from './helpers.js'

const now = moment('2026-10-27T10:00:00Z')
const options = { now, me: 'admin' }
const uids = tasks => tasks.map(task => task.uid).sort()

/**
 * Project
 *   Step one (important)
 *     Detail
 *   Step two
 *   Step done (completed)
 * Single (with only a completed subtask)
 *   Old step (completed)
 * Closed main task (completed) with a subtask
 */
const build = () => {
	const cal = makeCalendar('f')
	const project = makeTask(cal, { uid: 'project', summary: 'Project' })
	const one = makeTask(cal, { uid: 'one', related: 'project', priority: 1 })
	const detail = makeTask(cal, { uid: 'detail', related: 'one' })
	const two = makeTask(cal, { uid: 'two', related: 'project' })
	const done = makeTask(cal, { uid: 'done', related: 'project', status: 'COMPLETED', percent: 100, completed: now.clone().subtract(1, 'day') })
	link(project, one)
	link(one, detail)
	link(project, two)
	link(project, done)
	const single = makeTask(cal, { uid: 'single' })
	const old = makeTask(cal, { uid: 'old', related: 'single', status: 'COMPLETED', percent: 100, completed: now.clone().subtract(2, 'day') })
	link(single, old)
	const closed = makeTask(cal, { uid: 'closed', status: 'COMPLETED', percent: 100, completed: now.clone().subtract(3, 'day') })
	const below = makeTask(cal, { uid: 'below', related: 'closed' })
	link(closed, below)
	return { cal, project, one, detail, two, done, single, old, closed, below }
}

describe('fold - main tasks of the list', () => {
	it('takes the main tasks of a list, closed ones only when shown', () => {
		const { cal } = build()
		expect(uids(listRoots([cal], null, options))).toEqual(['project', 'single'])
		expect(uids(listRoots([cal], null, { ...options, showClosed: true }))).toEqual(['closed', 'project', 'single'])
	})

	it('takes the main tasks that belong to a collection', () => {
		const { cal } = build()
		// The project counts because of its important subtask
		expect(uids(listRoots([cal], 'starred', options))).toEqual(['project'])
		expect(uids(listRoots([cal], 'all', { ...options, showClosed: true }))).toEqual(['closed', 'project', 'single'])
	})
})

describe('fold - shown subtasks', () => {
	it('hides closed subtasks unless they are shown', () => {
		const { project, done } = build()
		expect(listSubtaskFilter(null, false)(done, project)).toBe(false)
		expect(listSubtaskFilter(null, true)(done, project)).toBe(true)
		project.hideCompletedSubtasks = true
		expect(listSubtaskFilter(null, true)(done, project)).toBe(false)
	})

	it('keeps only the subtasks in the collection in the list of "Important"', () => {
		const { project, one, two } = build()
		expect(listSubtaskFilter('starred', false)(one, project)).toBe(true)
		expect(listSubtaskFilter('starred', false)(two, project)).toBe(false)
		// "All" shows every open subtask
		expect(listSubtaskFilter('all', false)(two, project)).toBe(true)
	})

	it('uses the rules of the main tasks in the table', () => {
		const { project, one, two, done } = build()
		expect(tableSubtaskFilter('starred', false, options)(one)).toBe(true)
		expect(tableSubtaskFilter('starred', false, options)(two)).toBe(false)
		expect(tableSubtaskFilter(null, false, options)(done)).toBe(false)
		expect(tableSubtaskFilter('all', true, options)(done, project)).toBe(true)
	})
})

describe('fold - tasks to open and close', () => {
	it('finds the tasks with shown subtasks on all levels', () => {
		const { cal, project, single } = build()
		expect(uids(foldableTasks([project, single], listSubtaskFilter(null, false)))).toEqual(['one', 'project'])
		expect(uids(foldableTasks([project, single], listSubtaskFilter(null, true)))).toEqual(['one', 'project', 'single'])
		expect(uids(viewFoldableTasks('list', [cal], null, options))).toEqual(['one', 'project'])
		expect(uids(viewFoldableTasks('list', [cal], null, { ...options, showClosed: true }))).toEqual(['closed', 'one', 'project', 'single'])
	})

	it('follows the collection in list and table', () => {
		const { cal } = build()
		expect(uids(viewFoldableTasks('list', [cal], 'starred', options))).toEqual(['project'])
		expect(uids(viewFoldableTasks('table', [cal], 'starred', options))).toEqual(['project'])
		expect(uids(viewFoldableTasks('table', [cal], null, options))).toEqual(['one', 'project'])
		expect(viewFoldableTasks('list', [makeCalendar('empty')], null, options)).toEqual([])
	})
})
