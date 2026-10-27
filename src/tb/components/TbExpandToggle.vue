<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Header button in the list and the table: opens the subtasks of all tasks
shown, or closes them all once they are all open. Not while searching, the
way to the matches is open then anyway.
-->
<template>
	<NcButton v-if="visible"
		class="tb-expand-toggle"
		variant="tertiary"
		:aria-label="label"
		:title="label"
		:disabled="searching"
		@click="toggle">
		<template #icon>
			<UnfoldLessHorizontal v-if="allOpen" :size="20" />
			<UnfoldMoreHorizontal v-else :size="20" />
		</template>
	</NcButton>
</template>

<script>
import { isFiltering, viewKeyForRoute } from '../board.js'
import { viewFoldableTasks } from '../fold.js'
import { tbt } from '../l10n.js'
import { isTaskReadOnly } from '../store/board.js'

import NcButton from '@nextcloud/vue/components/NcButton'

import UnfoldLessHorizontal from 'vue-material-design-icons/UnfoldLessHorizontal.vue'
import UnfoldMoreHorizontal from 'vue-material-design-icons/UnfoldMoreHorizontal.vue'

export default {
	name: 'TbExpandToggle',
	components: {
		NcButton,
		UnfoldLessHorizontal,
		UnfoldMoreHorizontal,
	},
	computed: {
		viewKey() {
			return viewKeyForRoute(this.$route)
		},
		/**
		 * 'list' or 'table'; the collections without board and table are always a list
		 *
		 * @return {string}
		 */
		mode() {
			return this.viewKey ? this.$store.getters.tbView(this.viewKey).mode : 'list'
		},
		/**
		 * The table only has a tree with the rows "Main tasks", the board has no such button
		 *
		 * @return {boolean}
		 */
		hasTree() {
			if (!this.$route.params.calendarId && !this.$route.params.collectionId) {
				return false
			}
			if (this.mode === 'table') {
				return this.$store.getters.tbView(this.viewKey).cards !== 'all'
			}
			return this.mode === 'list'
		},
		calendars() {
			if (this.$route.params.calendarId) {
				const calendar = this.$store.getters.getCalendarByRoute(this.$route)
				return calendar ? [calendar] : []
			}
			return this.$store.getters.getSortedCalendars
		},
		tasks() {
			if (!this.hasTree) {
				return []
			}
			const tasks = viewFoldableTasks(this.mode, this.calendars, this.$route.params.collectionId || null, {
				showClosed: this.$store.getters.tbShowClosed,
			})
			// Subtasks hidden with the menu entry of the task are stored in the task, so only when it may be changed
			return this.mode === 'list' ? tasks.filter(task => !task.hideSubtasks || !isTaskReadOnly(task)) : tasks
		},
		visible() {
			return this.tasks.length > 0
		},
		/**
		 * The list opens everything for a search, the table also for a filter
		 *
		 * @return {boolean}
		 */
		searching() {
			const { searchQuery, filter } = this.$store.getters
			return this.mode === 'table' ? isFiltering(searchQuery, filter) : !!searchQuery
		},
		allOpen() {
			return this.visible && this.tasks.every(this.isOpen)
		},
		label() {
			return this.allOpen ? tbt('Close all subtasks') : tbt('Open all subtasks')
		},
	},
	methods: {
		isOpen(task) {
			if (this.mode === 'table') {
				return this.$store.getters.isTbTableExpanded(task.key)
			}
			return !this.$store.getters.isTbCollapsed(task.key) && !task.hideSubtasks
		},
		toggle() {
			const open = !this.allOpen
			const keys = this.tasks.map(task => task.key)
			if (this.mode === 'table') {
				this.$store.commit('setTbTableExpanded', { keys, expanded: open })
				return
			}
			if (open) {
				// Like the arrow in front of the row: show them again
				this.tasks.filter(task => task.hideSubtasks).forEach(task => this.$store.dispatch('toggleSubtasksVisibility', task))
			}
			this.$store.commit('setTbCollapsed', { keys, collapsed: !open })
		},
	},
}
</script>
