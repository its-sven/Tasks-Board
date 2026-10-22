/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
import { shortDate, shortFormat } from '../../../../src/tb/dates.js'

import moment from '@nextcloud/moment'
import { describe, expect, it } from 'vitest'

describe('short dates', () => {
	it('drops the year from the numeric format of the locale', () => {
		expect(shortFormat('DD.MM.YYYY')).toBe('DD.MM.')
		expect(shortFormat('MM/DD/YYYY')).toBe('MM/DD')
		expect(shortFormat('DD/MM/YYYY')).toBe('DD/MM')
		expect(shortFormat('YYYY-MM-DD')).toBe('MM-DD')
		expect(shortFormat('D. M. YYYY')).toBe('D. M.')
	})

	it('keeps a two-digit year on request', () => {
		expect(shortFormat('DD.MM.YYYY', true)).toBe('DD.MM.YY')
		expect(shortFormat('MM/DD/YYYY', true)).toBe('MM/DD/YY')
	})

	it('formats valid dates only', () => {
		expect(shortDate(moment.invalid())).toBe('')
		expect(shortDate(null)).toBe('')
		const value = moment('2026-10-24', 'YYYY-MM-DD')
		expect(shortDate(value)).toBe(value.format(shortFormat(moment.localeData().longDateFormat('L'))))
	})
})
