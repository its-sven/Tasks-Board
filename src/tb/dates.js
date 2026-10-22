/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Short dates in the format of the user's locale, derived from its numeric
 * date format (L): 24.10. in German, 10/24 in English, 10-24 for ISO.
 */

import moment from '@nextcloud/moment'

/**
 * @param {string} format A numeric moment date format like DD.MM.YYYY
 * @param {boolean} withYear Keep a two-digit year
 * @return {string} The format for day and month (and year)
 */
export function shortFormat(format, withYear = false) {
	if (withYear) {
		return format.replace(/Y{4}/, 'YY')
	}
	return format
		.replace(/Y+/, '')
		.replace(/^[^DM]+/, '')
		.replace(/[^DM.]+$/, '')
}

/**
 * @param {moment.Moment} value The date
 * @param {boolean} withYear Show a two-digit year
 * @return {string} Day and month in the user's locale ('' for an invalid date)
 */
export function shortDate(value, withYear = false) {
	if (!value || !value.isValid()) {
		return ''
	}
	const locale = moment.localeData(value.locale())
	return value.format(shortFormat(locale.longDateFormat('L'), withYear))
}
