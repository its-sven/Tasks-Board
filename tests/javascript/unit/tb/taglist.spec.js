import { isManagedTag, normalizeTagList, tagOptions, unknownTags } from '../../../../src/tb/taglist.js'

import { describe, expect, it } from 'vitest'

describe('tag list', () => {
	it('cleans the list', () => {
		expect(normalizeTagList(['  Server ', 'server', '', 'Netz,werk', 3, 'A   B'])).toEqual(['Server', 'Netz werk', 'A B'])
		expect(normalizeTagList('["Kunde","Kunde"]')).toEqual(['Kunde'])
		expect(normalizeTagList('kaputt')).toEqual([])
		expect(normalizeTagList({})).toEqual([])
		expect(normalizeTagList(['x'.repeat(120)])[0]).toHaveLength(100)
	})

	it('suggests the fixed list first, then other tags', () => {
		expect(tagOptions(['Server', 'Kunde'], ['zebra', 'kunde', 'Alpha'])).toEqual(['Server', 'Kunde', 'Alpha', 'zebra'])
		expect(tagOptions([], ['b', 'a'])).toEqual(['a', 'b'])
	})

	it('finds tags that are not in the list (not the waiting tag)', () => {
		expect(unknownTags(['server', 'Neu', 'waiting'], ['Server'])).toEqual(['Neu'])
		expect(unknownTags(['Neu'], [])).toEqual([])
		expect(isManagedTag('KUNDE', ['Kunde'])).toBe(true)
		expect(isManagedTag('Kunden', ['Kunde'])).toBe(false)
	})
})
