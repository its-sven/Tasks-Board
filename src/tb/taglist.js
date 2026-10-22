/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Fixed tag list: tags an administrator defined for everyone. They are
 * suggested first; other tags are still allowed but marked as "not in the list".
 */

import { isWaitingTagName } from './waiting.js'

/** Limits (also checked by the server) */
export const MAX_TAGS = 300
export const MAX_TAG_LENGTH = 100

/**
 * @param {string} tag A tag
 * @return {string} Key for comparing tags (case-insensitive)
 */
function tagKey(tag) {
	return String(tag).trim().toLocaleLowerCase()
}

/**
 * Cleans a tag list: text only, trimmed, no duplicates (case-insensitive), order kept
 *
 * @param {Array|string} value List or JSON
 * @return {string[]}
 */
export function normalizeTagList(value) {
	let list = value
	if (typeof value === 'string') {
		try {
			list = JSON.parse(value || '[]')
		} catch {
			list = []
		}
	}
	if (!Array.isArray(list)) {
		return []
	}
	const seen = new Set()
	const result = []
	for (const entry of list) {
		if (typeof entry !== 'string') {
			continue
		}
		const tag = entry.trim().replace(/,/g, ' ').replace(/\s+/g, ' ').slice(0, MAX_TAG_LENGTH)
		const key = tagKey(tag)
		if (!tag || seen.has(key)) {
			continue
		}
		seen.add(key)
		result.push(tag)
		if (result.length >= MAX_TAGS) {
			break
		}
	}
	return result
}

/**
 * Tags to suggest: the fixed list first (in its order), then the other tags in use
 *
 * @param {string[]} managed The fixed tag list
 * @param {string[]} used Tags used in the tasks
 * @return {string[]}
 */
export function tagOptions(managed, used) {
	const keys = new Set(managed.map(tagKey))
	const others = (used || [])
		.filter(tag => !keys.has(tagKey(tag)))
		.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
	return [...managed, ...others]
}

/**
 * Tags of a task that are not in the fixed list (the waiting tag is a system tag)
 *
 * @param {string[]} tags Tags of the task
 * @param {string[]} managed The fixed tag list
 * @return {string[]}
 */
export function unknownTags(tags, managed) {
	if (!managed.length) {
		return []
	}
	const keys = new Set(managed.map(tagKey))
	return (tags || []).filter(tag => !keys.has(tagKey(tag)) && !isWaitingTagName(tag))
}

/**
 * Whether a tag is in the fixed list
 *
 * @param {string} tag The tag
 * @param {string[]} managed The fixed tag list
 * @return {boolean}
 */
export function isManagedTag(tag, managed) {
	const key = tagKey(tag)
	return managed.some(entry => tagKey(entry) === key)
}
