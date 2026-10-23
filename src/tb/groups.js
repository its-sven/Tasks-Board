/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import client from '../services/cdav.js'
import { urldecode } from '../utils/url.js'

/**
 * Searches groups by name (like the share dialog of a list)
 *
 * @param {string} query The search
 * @return {Promise<Array>} [{ groupId, displayName, uri }]
 */
export async function searchGroups(query) {
	let results
	try {
		results = await client.principalPropertySearchByDisplayname(query)
	} catch (error) {
		console.debug('Tasks Board: group search failed', error)
		return []
	}
	return results
		.filter(result => result.calendarUserType === 'GROUP')
		.map(result => ({
			groupId: urldecode(result.groupId),
			displayName: result.displayname || urldecode(result.groupId),
			uri: urldecode(result.principalScheme),
		}))
}
