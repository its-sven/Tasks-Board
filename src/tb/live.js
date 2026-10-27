/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Live updates: changes made by other people, in other windows or by other
 * CalDAV clients show up without reloading.
 *
 * Every list is compared with the server by WebDAV sync (RFC 6578): the
 * server only reports the tasks that changed since the last sync token.
 * This runs every 30 seconds while the page is visible, right away when the
 * window gets the focus again, right away in all other tabs of the same
 * browser after a change (BroadcastChannel), and right away when the server
 * reports a new activity through the notify_push app (if it is installed;
 * changes in shared lists and new shares create activities).
 *
 * Lists that are new on the server (created elsewhere, shared with the user)
 * are loaded, lists that are gone (deleted, no longer shared) are removed.
 *
 * Tasks that are being edited (open in the sidebar with the cursor in a
 * field, or currently saved) are left alone and updated in a later round.
 */

import Task from '../models/task.js'
import { tbt } from './l10n.js'

import Axios from '@nextcloud/axios'
import { showInfo } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'
import { listen } from '@nextcloud/notify_push'
import { toRaw } from 'vue'

const DAV = 'DAV:'
const NC = 'http://nextcloud.com/ns'
const INTERVAL = 30 * 1000
const MIN_GAP = 3 * 1000
const MULTIGET_CHUNK = 50
const PARALLEL = 4
const CHANNEL = 'tasks_board.live'

/** Store actions that change tasks on the server */
const WRITING_ACTIONS = ['createTask', 'duplicateTask', 'deleteTask', 'updateTask', 'moveTask', 'tbImportTasks']

/**
 * Path of a DAV href, decoded, so hrefs from different sources can be compared
 *
 * @param {string} href The href (absolute URL or path)
 * @return {string} The decoded path
 */
export function normalizeHref(href) {
	if (!href) {
		return ''
	}
	let path = href
	try {
		path = new URL(href, 'http://localhost').pathname
	} catch {
		// keep the href as it is
	}
	try {
		return decodeURIComponent(path)
	} catch {
		return path
	}
}

/**
 * Reads the answer of a sync-collection REPORT
 *
 * @param {string} xml The multistatus document
 * @return {object} { token, changed: [{ href, etag }], removed: [href] }
 */
export function parseSyncResponse(xml) {
	const doc = new DOMParser().parseFromString(xml, 'application/xml')
	const root = doc.documentElement
	const result = { token: null, changed: [], removed: [] }
	if (!root) {
		return result
	}
	for (const child of Array.from(root.children)) {
		if (child.namespaceURI !== DAV) {
			continue
		}
		if (child.localName === 'sync-token') {
			result.token = child.textContent.trim()
		}
		if (child.localName !== 'response') {
			continue
		}
		const href = Array.from(child.children).find(node => node.namespaceURI === DAV && node.localName === 'href')?.textContent.trim()
		if (!href || href.endsWith('/')) {
			// The collection itself
			continue
		}
		const status = Array.from(child.children).find(node => node.namespaceURI === DAV && node.localName === 'status')?.textContent || ''
		if (/\s404\s/.test(status + ' ')) {
			result.removed.push(href)
			continue
		}
		const etag = Array.from(child.querySelectorAll('*')).find(node => node.namespaceURI === DAV && node.localName === 'getetag')?.textContent.trim() || null
		result.changed.push({ href, etag })
	}
	return result
}

/**
 * Compares the reported changes with the tasks of a list
 *
 * @param {Array} tasks The tasks of the list in the store
 * @param {object} report The parsed sync answer
 * @param {object} options Options
 * @param {boolean} options.full The report contains all tasks of the list (first sync): tasks that are missing were deleted
 * @param {string[]} options.pending Hrefs that were left out last time
 * @return {object} { fetch: [href], remove: [task] }
 */
export function planChanges(tasks, report, { full = false, pending = [] } = {}) {
	const byHref = new Map(tasks.filter(task => task.dav).map(task => [normalizeHref(task.dav.url), task]))
	const fetch = new Set(pending)
	for (const { href, etag } of report.changed) {
		const task = byHref.get(normalizeHref(href))
		// Unchanged (for example our own change): nothing to do
		if (task && etag && task.dav.etag === etag) {
			continue
		}
		fetch.add(href)
	}
	const removed = new Set(report.removed.map(normalizeHref))
	if (full) {
		const present = new Set(report.changed.map(entry => normalizeHref(entry.href)))
		for (const href of byHref.keys()) {
			if (!present.has(href)) {
				removed.add(href)
			}
		}
	}
	const remove = []
	for (const href of removed) {
		const task = byHref.get(href)
		if (task) {
			remove.push(task)
		}
		fetch.delete(href)
	}
	return { fetch: [...fetch].filter(href => !removed.has(normalizeHref(href))), remove }
}

/**
 * Whether a task should not be replaced right now
 *
 * @param {object} task The task
 * @return {boolean}
 */
function isBusy(task) {
	if (task.updateRunning || task.updateScheduled || task.deleteCountdown !== null) {
		return true
	}
	const active = document.activeElement
	const editable = active && (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName))
	// A field of this task in the list (e.g. renaming)
	if (editable && active.closest(`[data-task-key="${CSS.escape(task.key)}"]`)) {
		return true
	}
	const sidebar = document.getElementById('app-sidebar-vue')
	let path = window.location.pathname
	try {
		path = decodeURIComponent(path)
	} catch {
		// keep the path
	}
	if (!sidebar || !task.uri || !path.endsWith('/tasks/' + task.uri)) {
		return false
	}
	// The sidebar of this task: a field has the cursor or the notes are being edited
	return (editable && sidebar.contains(active)) || !!sidebar.querySelector('.tb-notes__editor')
}

/**
 * Reads the current sync tokens of all lists below a calendar home (one request).
 * Lists in the trash bin are still listed there (with a deletion date) and are left out.
 *
 * @param {string} xml The multistatus document of a PROPFIND
 * @return {Map} Decoded href of the list => token
 */
export function parseTokens(xml) {
	const doc = new DOMParser().parseFromString(xml, 'application/xml')
	const tokens = new Map()
	for (const response of Array.from(doc.documentElement?.children || [])) {
		if (response.namespaceURI !== DAV || response.localName !== 'response') {
			continue
		}
		const nodes = Array.from(response.querySelectorAll('*'))
		const href = nodes.find(node => node.namespaceURI === DAV && node.localName === 'href')?.textContent.trim()
		const token = nodes.find(node => node.namespaceURI === DAV && node.localName === 'sync-token')?.textContent.trim()
		const deleted = nodes.find(node => node.namespaceURI === NC && node.localName === 'deleted-at')?.textContent.trim()
		if (href && token && !deleted) {
			tokens.set(normalizeHref(href).replace(/\/?$/, '/'), token)
		}
	}
	return tokens
}

/**
 * @param {string} url The URL of a calendar home
 * @return {Promise<Map>} Decoded href of the list => token
 */
async function requestTokens(url) {
	const response = await Axios({
		method: 'PROPFIND',
		url,
		data: '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.com/ns"><d:prop><d:sync-token/><nc:deleted-at/></d:prop></d:propfind>',
		headers: { 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
		responseType: 'text',
		transformResponse: [data => data],
	})
	return parseTokens(response.data)
}

/**
 * @param {string} url The URL of a list
 * @return {string} Its decoded path with a trailing slash, as in parseTokens
 */
function listHref(url) {
	return normalizeHref(url).replace(/\/?$/, '/')
}

/**
 * Lists that appeared or disappeared below a calendar home
 *
 * @param {Map} current Decoded href => sync token of all collections below the home (parseTokens)
 * @param {Array} calendars The lists (calendars) of this home in the store
 * @param {Set} ignored Hrefs of collections that are no lists (looked for before)
 * @return {object} { added: [href], removed: [calendar] }
 */
export function homeChanges(current, calendars, ignored = new Set()) {
	const known = new Set(calendars.map(calendar => listHref(calendar.dav.url)))
	// An answer without any of the known lists is not trusted: nothing is removed then
	const trusted = calendars.some(calendar => current.has(listHref(calendar.dav.url)))
	return {
		added: [...current.keys()].filter(href => !known.has(href) && !ignored.has(href)),
		removed: trusted ? calendars.filter(calendar => calendar.supportsTasks && !current.has(listHref(calendar.dav.url))) : [],
	}
}

/**
 * Sends a sync-collection REPORT
 *
 * @param {string} url The URL of the list
 * @param {string} token The last sync token ('' for all tasks)
 * @return {Promise<object>} The parsed answer
 */
async function requestSync(url, token) {
	const escaped = token.replace(/&/g, '&amp;').replace(/</g, '&lt;')
	const body = '<?xml version="1.0" encoding="utf-8"?>'
		+ '<d:sync-collection xmlns:d="DAV:">'
		+ '<d:sync-token>' + escaped + '</d:sync-token>'
		+ '<d:sync-level>1</d:sync-level>'
		+ '<d:prop><d:getetag/></d:prop>'
		+ '</d:sync-collection>'
	const response = await Axios({
		method: 'REPORT',
		url,
		data: body,
		headers: { 'Content-Type': 'application/xml; charset=utf-8', Depth: '1' },
		responseType: 'text',
		transformResponse: [data => data],
	})
	return parseSyncResponse(response.data)
}

export class LiveSync {

	/**
	 * @param {object} store The Vuex store
	 */
	constructor(store) {
		this.store = store
		this.tokens = new Map()
		this.pending = new Map()
		this.running = null
		this.again = false
		this.lastRun = 0
		this.timer = null
		this.channel = null
		this.broadcastTimer = null
		// Collections below the calendar home that are no lists
		this.ignored = new Set()
		this.push = false
	}

	start() {
		this.timer = window.setInterval(() => {
			if (document.visibilityState === 'visible') {
				this.sync()
			}
		}, INTERVAL)
		document.addEventListener('visibilitychange', this.onWake)
		window.addEventListener('focus', this.onWake)
		if (typeof BroadcastChannel !== 'undefined') {
			this.channel = new BroadcastChannel(CHANNEL)
			this.channel.onmessage = () => this.sync({ force: true })
		}
		this.unsubscribe = this.store.subscribeAction({
			after: (action) => {
				if (WRITING_ACTIONS.includes(action.type)) {
					this.announce()
				}
			},
		})
		try {
			this.push = listen('notify_activity', this.onPush)
		} catch (error) {
			console.debug('Tasks Board: no push from the server', error)
		}
	}

	stop() {
		window.clearInterval(this.timer)
		document.removeEventListener('visibilitychange', this.onWake)
		window.removeEventListener('focus', this.onWake)
		this.channel?.close()
		this.unsubscribe?.()
	}

	onWake = () => {
		if (document.visibilityState === 'visible') {
			this.sync()
		}
	}

	/** New activity on the server: compare now (a hidden tab does it when it is shown again) */
	onPush = () => {
		if (document.visibilityState === 'visible') {
			this.sync({ force: true })
		}
	}

	/** Tells the other tabs that something changed (bundled) */
	announce() {
		if (!this.channel) {
			return
		}
		window.clearTimeout(this.broadcastTimer)
		this.broadcastTimer = window.setTimeout(() => this.channel.postMessage({ type: 'changed' }), 300)
	}

	/**
	 * Compares all lists with the server
	 *
	 * @param {object} options Options
	 * @param {boolean} options.force Also right after the last round
	 * @return {Promise}
	 */
	async sync({ force = false } = {}) {
		if (this.running) {
			this.again = true
			return this.running
		}
		if (!force && Date.now() - this.lastRun < MIN_GAP) {
			return
		}
		this.running = (async () => {
			do {
				this.again = false
				this.lastRun = Date.now()
				// Only the lists whose sync token changed (one request per calendar home)
				const calendars = await this.changedCalendars([...this.store.state.calendars.calendars])
				// A few lists at the same time
				const queue = [...calendars]
				const worker = async () => {
					while (queue.length) {
						const calendar = queue.shift()
						try {
							await this.syncCalendar(calendar)
						} catch (error) {
							console.debug('Tasks Board: live update of a list failed', calendar.id, error)
						}
					}
				}
				await Promise.all(Array.from({ length: PARALLEL }, worker))
			} while (this.again)
		})()
		try {
			await this.running
		} finally {
			this.running = null
		}
	}

	/**
	 * The lists that changed since the last sync. New lists below a calendar
	 * home are loaded, lists that are gone are removed.
	 *
	 * @param {Array} calendars All lists
	 * @return {Promise<Array>} The lists to sync
	 */
	async changedCalendars(calendars) {
		const homes = new Map()
		for (const calendar of calendars) {
			const url = calendar.dav?.url
			if (!url) {
				continue
			}
			const home = url.replace(/[^/]+\/?$/, '')
			if (!homes.has(home)) {
				homes.set(home, [])
			}
			homes.get(home).push(calendar)
		}
		const result = []
		for (const [home, list] of homes) {
			let current
			try {
				current = await requestTokens(home)
			} catch (error) {
				console.debug('Tasks Board: could not read the sync tokens', home, error)
				result.push(...list)
				continue
			}
			const { added, removed } = homeChanges(current, list, this.ignored)
			if (added.length) {
				await this.loadLists(added)
			}
			for (const calendar of removed) {
				this.removeList(calendar)
			}
			for (const calendar of list) {
				if (removed.includes(calendar)) {
					continue
				}
				const known = this.tokens.has(calendar.id) ? this.tokens.get(calendar.id) : calendar.dav.syncToken
				const token = current.get(listHref(calendar.dav.url))
				// Also lists with tasks that were left out last time (being edited)
				if (!token || !known || token !== known || this.pending.get(calendar.id)?.size) {
					result.push(calendar)
				}
			}
		}
		return result
	}

	/**
	 * Loads the lists that are new on the server
	 *
	 * @param {string[]} hrefs The new collections below a calendar home
	 */
	async loadLists(hrefs) {
		let found
		try {
			found = new Set((await this.store.dispatch('tbLoadNewCalendars')).map(listHref))
		} catch (error) {
			console.debug('Tasks Board: could not load the new lists', error)
			return
		}
		// Not looked for again: collections that are no lists (e.g. inbox, trash bin)
		for (const href of hrefs) {
			if (!found.has(href)) {
				this.ignored.add(href)
			}
		}
	}

	/**
	 * Removes a list that was deleted or is no longer shared with the user
	 *
	 * @param {object} calendar The list
	 */
	removeList(calendar) {
		const { store } = this
		if (!store.state.calendars.calendars.includes(calendar)) {
			return
		}
		Object.values(calendar.tasks).forEach(task => store.commit('deleteTask', task))
		store.commit('deleteCalendar', calendar)
		this.tokens.delete(calendar.id)
		this.pending.delete(calendar.id)
		const path = decodeURIComponent(window.location.pathname)
		if (calendar.supportsTasks && path.includes('/calendars/' + calendar.id)) {
			// The list was open: back to the start page
			showInfo(tbt('The list "{list}" is no longer available.', { list: calendar.displayName }))
			import('../router.js').then(({ default: router }) => router.push('/'))
		}
	}

	/**
	 * @param {object} calendar The list
	 */
	async syncCalendar(calendar) {
		if (!calendar.dav?.url) {
			return
		}
		let token = this.tokens.has(calendar.id) ? this.tokens.get(calendar.id) : (calendar.dav.syncToken || '')
		let report
		try {
			report = await requestSync(calendar.dav.url, token)
		} catch (error) {
			const status = error?.response?.status
			if (token && [403, 409, 507].includes(status)) {
				// The token is no longer valid: compare everything
				token = ''
				report = await requestSync(calendar.dav.url, token)
			} else {
				throw error
			}
		}
		const tasks = Object.values(calendar.tasks)
		const pending = [...(this.pending.get(calendar.id) || [])]
		const plan = planChanges(tasks, report, { full: token === '', pending })
		const leftOut = new Set()

		for (const task of plan.remove) {
			if (task.updateRunning) {
				continue
			}
			this.removeTask(task)
		}

		for (let i = 0; i < plan.fetch.length; i += MULTIGET_CHUNK) {
			const hrefs = plan.fetch.slice(i, i + MULTIGET_CHUNK)
			const items = await calendar.dav.calendarMultiget(hrefs)
			for (const item of items) {
				if (!item?.data) {
					continue
				}
				const left = this.applyItem(calendar, item)
				if (left) {
					leftOut.add(item.url)
				}
			}
		}

		this.pending.set(calendar.id, leftOut)
		if (report.token) {
			this.tokens.set(calendar.id, report.token)
		}
	}

	/**
	 * Adds or replaces a task from the server
	 *
	 * @param {object} calendar The list
	 * @param {object} item The calendar object (VObject) from the server
	 * @return {boolean} Whether the task was left out for now (being edited)
	 */
	applyItem(calendar, item) {
		const { store } = this
		let fresh
		try {
			fresh = new Task(item.data, calendar)
		} catch (error) {
			console.debug('Tasks Board: could not read a task', item.url, error)
			return false
		}
		const existing = Object.values(calendar.tasks).find(task => task.dav && normalizeHref(task.dav.url) === normalizeHref(item.url))
			|| calendar.tasks[fresh.uid]
		if (existing) {
			if (existing.dav && existing.dav.etag === item.etag) {
				return false
			}
			if (isBusy(existing)) {
				return true
			}
			// The task object is replaced instead of changed in place: the store keeps
			// tasks as reactive proxies, and ICAL.js compares time zones by identity.
			const old = toRaw(existing)
			fresh.dav = item
			fresh.subTasks = old.subTasks
			fresh.loadedCompleted = old.loadedCompleted
			if (old.related && old.related !== fresh.related) {
				// Moved to another main task
				const oldParent = this.findTask(calendar, old.related)
				if (oldParent) {
					delete oldParent.subTasks[old.uid]
				}
			}
			store.commit('appendTasksToCalendar', { calendar, tasks: [fresh] })
			store.commit('appendTasks', [fresh])
			store.commit('addTaskToParent', { task: fresh, parent: this.findTask(calendar, fresh.related) })
			return false
		}
		// New task: completed ones only if the completed tasks of the list are loaded
		if (fresh.completed && !calendar.loadedCompleted) {
			return false
		}
		fresh.dav = item
		store.commit('addTaskToParent', { task: fresh, parent: this.findTask(calendar, fresh.related) })
		for (const subTask of Object.values(calendar.tasks).filter(task => task.related === fresh.uid)) {
			store.commit('addTaskToParent', { task: subTask, parent: fresh })
		}
		store.commit('appendTasksToCalendar', { calendar, tasks: [fresh] })
		store.commit('appendTasks', [fresh])
		return false
	}

	/**
	 * @param {object} calendar The list
	 * @param {string|null} uid The uid
	 * @return {object|null} The task of the list with this uid
	 */
	findTask(calendar, uid) {
		return (uid && calendar.tasks[uid]) || null
	}

	/**
	 * Removes a task that was deleted on the server
	 *
	 * @param {object} task The task
	 */
	removeTask(task) {
		const { store } = this
		store.commit('deleteTask', task)
		store.commit('deleteTaskFromParent', { task, parent: this.findTask(task.calendar, task.related) })
		store.commit('deleteTaskFromCalendar', task)
		emit('tasks:task:deleted', { taskId: task.uri })
	}

}

let instance = null

/**
 * Starts the live updates (once)
 *
 * @param {object} store The Vuex store
 * @return {LiveSync} The running instance
 */
export function startLiveSync(store) {
	if (!instance) {
		instance = new LiveSync(store)
		instance.start()
	}
	return instance
}
