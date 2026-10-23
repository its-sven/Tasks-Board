import { DASHBOARD_ENTRY, moveEntry, orderedEntries } from '../../../../src/tb/navigation.js'

import { describe, expect, it } from 'vitest'

describe('navigation order', () => {
	const ids = ['starred', 'assigned', 'today', 'completed']

	it('starts with the default order', () => {
		expect(orderedEntries(ids, null)).toEqual([DASHBOARD_ENTRY, ...ids])
		expect(orderedEntries(ids, [])).toEqual([DASHBOARD_ENTRY, ...ids])
	})

	it('keeps the stored order and adds new collections at the end', () => {
		expect(orderedEntries(ids, ['today', 'dashboard', 'starred'])).toEqual(['today', 'dashboard', 'starred', 'assigned', 'completed'])
	})

	it('drops unknown and duplicate ids', () => {
		expect(orderedEntries(ids, ['gone', 'today', 'today', 'starred'])).toEqual(['today', 'starred', 'dashboard', 'assigned', 'completed'])
	})

	it('moves an entry', () => {
		const order = orderedEntries(ids, null)
		expect(moveEntry(order, 4, 0)).toEqual(['completed', 'dashboard', 'starred', 'assigned', 'today'])
		expect(moveEntry(order, 0, 2)).toEqual(['starred', 'assigned', 'dashboard', 'today', 'completed'])
		expect(moveEntry(order, 0, 9)).toEqual(order)
	})
})
