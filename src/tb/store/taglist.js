/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Vuex module "tbTagList": the fixed tag list and the waiting tag (both set by administrators).
 */

import Requests from '../../services/requests.js'
import { normalizeTagList } from '../taglist.js'
import { defaultWaitingTag, normalizeWaitingTag, setWaitingTag } from '../waiting.js'

import { getCurrentUser } from '@nextcloud/auth'
import { loadState } from '@nextcloud/initial-state'
import { getLanguage } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'

/* global appName */

/**
 * @return {string[]} The tag list from the page
 */
function initialTagList() {
	try {
		return normalizeTagList(loadState(appName, 'tbTagList', '[]'))
	} catch {
		return []
	}
}

/**
 * @param {string} key Name of the initial state
 * @param {string} fallback Value if the page has none
 * @return {string} The tag from the page
 */
function initialTag(key, fallback) {
	try {
		return normalizeWaitingTag(loadState(appName, key, fallback)) || fallback
	} catch {
		return fallback
	}
}

const state = () => {
	const waitingTagDefault = initialTag('tbWaitingTagDefault', defaultWaitingTag(getLanguage()))
	const waitingTag = initialTag('tbWaitingTag', waitingTagDefault)
	setWaitingTag(waitingTag)
	return {
		list: initialTagList(),
		waitingTag,
		waitingTagDefault,
	}
}

const getters = {
	tbTagList: (state) => state.list,
	tbCanEditTagList: () => !!getCurrentUser()?.isAdmin,
	tbWaitingTag: (state) => state.waitingTag,
	tbWaitingTagDefault: (state) => state.waitingTagDefault,
}

const mutations = {
	setTbTagList(state, list) {
		state.list = normalizeTagList(list)
	},
	setTbWaitingTag(state, tag) {
		state.waitingTag = normalizeWaitingTag(tag) || state.waitingTagDefault
		setWaitingTag(state.waitingTag)
	},
}

const actions = {
	/**
	 * Saves the tag list (administrators only, the server checks this)
	 *
	 * @param {object} context The store context
	 * @param {string[]} list The new list
	 * @return {Promise<string[]>} The saved list
	 */
	async saveTbTagList(context, list) {
		const before = context.state.list
		context.commit('setTbTagList', list)
		try {
			const response = await Requests.post(generateUrl('apps/' + appName + '/api/v1/board/taglist'), { tags: context.state.list })
			const saved = response?.data?.data
			if (Array.isArray(saved)) {
				context.commit('setTbTagList', saved)
			}
			return context.state.list
		} catch (error) {
			console.error('Could not save the tag list', error)
			context.commit('setTbTagList', before)
			throw error
		}
	},

	/**
	 * Saves the waiting tag (administrators only, the server checks this).
	 * An empty tag goes back to the default.
	 *
	 * @param {object} context The store context
	 * @param {string} tag The new tag
	 * @return {Promise<string>} The saved tag
	 */
	async saveTbWaitingTag(context, tag) {
		const before = context.state.waitingTag
		context.commit('setTbWaitingTag', tag)
		try {
			const response = await Requests.post(generateUrl('apps/' + appName + '/api/v1/board/waitingtag'), { tag: normalizeWaitingTag(tag) })
			const saved = response?.data?.data
			if (typeof saved === 'string') {
				context.commit('setTbWaitingTag', saved)
			}
			return context.state.waitingTag
		} catch (error) {
			console.error('Could not save the waiting tag', error)
			context.commit('setTbWaitingTag', before)
			throw error
		}
	},
}

export default { state, getters, mutations, actions }
