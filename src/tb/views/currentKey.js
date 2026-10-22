/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import { sortKeyForRoute } from '../sort.js'

/**
 * Mixin for the route views: tells the store which list or collection is shown,
 * so sorting and grouping of that list apply.
 */
export default {
	watch: {
		$route: {
			immediate: true,
			handler(route) {
				const key = sortKeyForRoute(route)
				if (this.$store.state.tbBoard.currentKey !== key) {
					this.$store.commit('setTbCurrentKey', key)
				}
			},
		},
	},
}
