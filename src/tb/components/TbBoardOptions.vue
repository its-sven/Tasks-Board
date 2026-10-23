<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
View options in the header.
Table: columns (for all lists), rows, open/close all subtasks.
List: style (cards, rows, compact) for all lists, open/close all subtasks.
Board: which cards, rows, order in the columns (per list).
Completed and cancelled tasks: own button in the header (TbClosedToggle).
-->
<template>
	<NcActions v-if="isTable"
		class="tb-board-options tb-table-options"
		:aria-label="tbt('Table settings')"
		:title="tbt('Table settings')"
		:force-menu="true">
		<template #icon>
			<TuneVariant :size="20" />
		</template>
		<NcActionCaption :name="tbt('Columns (drag the header to move)')" />
		<NcActionCheckbox v-for="column in tableColumns"
			:key="column.key"
			:model-value="column.visible"
			:disabled="column.fixed"
			@update:model-value="setColumn(column.key, $event)">
			{{ tbt(column.label) }}{{ column.key === 'calendar' && !isCollection ? ' (' + tbt('only in collections') + ')' : '' }}
		</NcActionCheckbox>
		<NcActionButton :close-after-click="true" @click="resetColumns">
			<template #icon>
				<Restore :size="20" />
			</template>
			{{ tbt('Reset columns') }}
		</NcActionButton>
		<NcActionSeparator />
		<NcActionCaption :name="tbt('Rows')" />
		<NcActionRadio name="tb-table-rows"
			value="root"
			:model-value="view.cards"
			@update:model-value="setView({ cards: 'root' })">
			{{ tbt('Main tasks') }}
		</NcActionRadio>
		<NcActionRadio name="tb-table-rows"
			value="all"
			:model-value="view.cards"
			@update:model-value="setView({ cards: 'all' })">
			{{ tbt('All tasks incl. subtasks') }}
		</NcActionRadio>
		<template v-if="view.cards !== 'all'">
			<NcActionSeparator />
			<NcActionCaption :name="tbt('Subtasks')" />
			<NcActionButton :close-after-click="true" @click="expandAllRows">
				<template #icon>
					<UnfoldMoreHorizontal :size="20" />
				</template>
				{{ tbt('Open all') }}
			</NcActionButton>
			<NcActionButton :close-after-click="true" @click="collapseAllRows">
				<template #icon>
					<UnfoldLessHorizontal :size="20" />
				</template>
				{{ tbt('Close all') }}
			</NcActionButton>
		</template>
	</NcActions>
	<NcActions v-else-if="!isBoard"
		class="tb-board-options tb-view-options"
		:aria-label="tbt('View options')"
		:title="tbt('View options')"
		:force-menu="true">
		<template #icon>
			<TuneVariant :size="20" />
		</template>
		<NcActionCaption :name="tbt('List style')" />
		<NcActionRadio v-for="option in listStyles"
			:key="option.value"
			name="tb-list-style"
			:value="option.value"
			:model-value="listStyle"
			@update:model-value="setListStyle(option.value)">
			{{ option.label }}
		</NcActionRadio>
		<NcActionSeparator />
		<NcActionCaption :name="tbt('Subtasks')" />
		<NcActionButton :close-after-click="true" @click="expandAll">
			<template #icon>
				<UnfoldMoreHorizontal :size="20" />
			</template>
			{{ tbt('Open all') }}
		</NcActionButton>
		<NcActionButton :close-after-click="true" @click="collapseAll">
			<template #icon>
				<UnfoldLessHorizontal :size="20" />
			</template>
			{{ tbt('Close all') }}
		</NcActionButton>
	</NcActions>
	<NcActions v-else
		class="tb-board-options"
		:aria-label="tbt('Board settings')"
		:title="tbt('Board settings')"
		:force-menu="true">
		<template #icon>
			<TuneVariant :size="20" />
		</template>
		<NcActionCaption :name="tbt('Cards')" />
		<NcActionRadio name="tb-board-cards"
			value="root"
			:model-value="view.cards"
			@update:model-value="setView({ cards: 'root' })">
			{{ tbt('Main tasks') }}
		</NcActionRadio>
		<NcActionRadio name="tb-board-cards"
			value="all"
			:model-value="view.cards"
			@update:model-value="setView({ cards: 'all' })">
			{{ tbt('All tasks incl. subtasks') }}
		</NcActionRadio>
		<NcActionSeparator />
		<NcActionCaption :name="tbt('Rows')" />
		<NcActionRadio v-for="option in laneOptions"
			:key="option.value"
			name="tb-board-lanes"
			:value="option.value"
			:model-value="lanes"
			:disabled="option.disabled"
			@update:model-value="setView({ lanes: option.value })">
			{{ option.label }}
		</NcActionRadio>
		<NcActionSeparator />
		<NcActionCaption :name="tbt('Order in the columns')" />
		<NcActionRadio name="tb-board-order"
			value="sort"
			:model-value="view.boardOrder || 'sort'"
			@update:model-value="setView({ boardOrder: 'sort' })">
			{{ tbt('Like the sort order') }}
		</NcActionRadio>
		<NcActionRadio name="tb-board-order"
			value="manual"
			:model-value="view.boardOrder || 'sort'"
			@update:model-value="setView({ boardOrder: 'manual' })">
			{{ tbt('By hand (drag cards)') }}
		</NcActionRadio>
	</NcActions>
</template>

<script>
import { effectiveLanes, viewKeyForRoute } from '../board.js'
import { tbt } from '../l10n.js'
import { normalizeColumns, setColumnVisible, storableColumns } from '../table.js'

import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCaption from '@nextcloud/vue/components/NcActionCaption'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActionRadio from '@nextcloud/vue/components/NcActionRadio'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'

import Restore from 'vue-material-design-icons/Restore.vue'
import TuneVariant from 'vue-material-design-icons/TuneVariant.vue'
import UnfoldLessHorizontal from 'vue-material-design-icons/UnfoldLessHorizontal.vue'
import UnfoldMoreHorizontal from 'vue-material-design-icons/UnfoldMoreHorizontal.vue'

export default {
	name: 'TbBoardOptions',
	components: {
		NcActionButton,
		NcActionCaption,
		NcActionCheckbox,
		NcActionRadio,
		NcActionSeparator,
		NcActions,
		Restore,
		TuneVariant,
		UnfoldLessHorizontal,
		UnfoldMoreHorizontal,
	},
	computed: {
		viewKey() {
			return viewKeyForRoute(this.$route)
		},
		view() {
			return this.$store.getters.tbView(this.viewKey)
		},
		isBoard() {
			return !!this.viewKey && this.view.mode === 'board'
		},
		isTable() {
			return !!this.viewKey && this.view.mode === 'table'
		},
		tableColumns() {
			return normalizeColumns(this.$store.getters.tbPrefs.tableColumns)
		},
		listStyle() {
			return this.$store.getters.tbPrefs.listStyle || 'cards'
		},
		listStyles() {
			return [
				{ value: 'cards', label: tbt('Cards') },
				{ value: 'rows', label: tbt('Rows with lines') },
				{ value: 'compact', label: tbt('Compact') },
			]
		},
		isCollection() {
			return !this.$route.params.calendarId
		},
		lanes() {
			return effectiveLanes(this.view)
		},
		laneOptions() {
			return [
				{ value: 'none', label: tbt('None') },
				{ value: 'calendar', label: tbt('List'), disabled: !this.isCollection },
				{ value: 'parent', label: tbt('Main task'), disabled: this.view.cards !== 'all' },
				{ value: 'priority', label: tbt('Priority') },
				{ value: 'assignee', label: tbt('Person') },
			]
		},
	},
	methods: {
		tbt,
		setView(patch) {
			this.$store.dispatch('setTbView', { key: this.viewKey, patch })
		},
		setColumn(key, visible) {
			this.$store.dispatch('setTbPrefs', { tableColumns: storableColumns(setColumnVisible(this.tableColumns, key, visible)) })
		},
		resetColumns() {
			this.$store.dispatch('setTbPrefs', { tableColumns: null })
		},
		setListStyle(listStyle) {
			this.$store.dispatch('setTbPrefs', { listStyle })
		},
		/**
		 * Tasks with subtasks
		 *
		 * @param {Array} calendars The lists, all loaded lists by default
		 * @return {string[]} Their keys
		 */
		parentKeys(calendars = this.$store.getters.getSortedCalendars) {
			const keys = []
			for (const calendar of calendars) {
				for (const task of Object.values(calendar.tasks)) {
					if (Object.keys(task.subTasks || {}).length) {
						keys.push(task.key)
					}
				}
			}
			return keys
		},
		expandAll() {
			this.$store.commit('setTbCollapsed', { keys: Object.keys(this.$store.state.tbBoard.collapsedTasks), collapsed: false })
		},
		collapseAll() {
			this.$store.commit('setTbCollapsed', { keys: this.parentKeys(), collapsed: true })
		},
		expandAllRows() {
			const calendar = this.$route.params.calendarId ? this.$store.getters.getCalendarByRoute(this.$route) : null
			const keys = this.parentKeys(calendar ? [calendar] : undefined)
			this.$store.commit('setTbTableExpanded', { keys, expanded: true })
		},
		collapseAllRows() {
			this.$store.commit('setTbTableExpanded', { keys: Object.keys(this.$store.state.tbBoard.tableExpanded), expanded: false })
		},
	},
}
</script>
