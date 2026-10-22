/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Dragging the width of the navigation or the sidebar: the width stays
 * between a minimum and a maximum. Dragged clearly below the minimum, the
 * bar closes when it is let go.
 */

/**
 * @param {number} width The width the pointer asks for
 * @param {object} limits Destructuring object
 * @param {number} limits.min Smallest width
 * @param {number} limits.max Largest width
 * @param {number} limits.collapseBelow Below this width the bar closes
 * @return {{width: number, collapse: boolean}} Width to show and whether letting go closes the bar
 */
export function resolveDrag(width, { min, max, collapseBelow }) {
	const upper = Math.max(min, max)
	return {
		width: Math.round(Math.min(Math.max(width, min), upper)),
		collapse: width < collapseBelow,
	}
}

/**
 * Reads a stored width
 *
 * @param {string} key localStorage key
 * @return {number|null}
 */
export function storedWidth(key) {
	try {
		const value = parseInt(window.localStorage.getItem(key))
		return Number.isFinite(value) ? value : null
	} catch {
		return null
	}
}

/**
 * Stores a width (null removes it)
 *
 * @param {string} key localStorage key
 * @param {number|null} width The width
 */
export function storeWidth(key, width) {
	try {
		if (width === null) {
			window.localStorage.removeItem(key)
		} else {
			window.localStorage.setItem(key, String(Math.round(width)))
		}
	} catch {
		// Private window or blocked storage: the width just isn't remembered
	}
}
