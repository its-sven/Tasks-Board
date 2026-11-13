<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
View options in the header.
Table: columns (for all lists), rows.
Timeline: scale, colour of the bars, tasks without dates, which projects are shown (per list).
List: style (cards, rows, compact) for all lists.
Board: which cards, rows, order in the columns (per list).
Completed and cancelled tasks and opening/closing all subtasks: own buttons
in the header (TbClosedToggle, TbExpandToggle).
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
	</NcActions>
	<NcActions v-else-if="isTimeline"
		class="tb-board-options tb-timeline-options"
		:aria-label="tbt('Timeline settings')"
		:title="tbt('Timeline settings')"
		:force-menu="true">
		<template #icon>
			<TuneVariant :size="20" />
		</template>
		<NcActionCaption :name="tbt('Scale')" />
		<NcActionRadio v-for="option in scaleOptions"
			:key="option.value"
			name="tb-timeline-scale"
			:value="option.value"
			:model-value="view.timelineScale || 'month'"
			@update:model-value="setView({ timelineScale: option.value })">
			{{ option.label }}
		</NcActionRadio>
		<NcActionSeparator />
		<NcActionCaption :name="tbt('Colour of the bars')" />
		<NcActionRadio v-for="option in colorOptions"
			:key="option.value"
			name="tb-timeline-color"
			:value="option.value"
			:model-value="view.timelineColor || 'calendar'"
			@update:model-value="setView({ timelineColor: option.value })">
			{{ option.label }}
		</NcActionRadio>
		<NcActionSeparator />
		<NcActionCaption :name="tbt('Group by')" />
		<NcActionRadio v-for="option in groupOptions"
			:key="option.value"
			name="tb-timeline-group"
			:value="option.value"
			:disabled="option.disabled"
			:model-value="timelineGroup"
			@update:model-value="setView({ timelineGroup: option.value })">
			{{ option.label }}
		</NcActionRadio>
		<NcActionSeparator />
		<NcActionCaption :name="tbt('Columns')" />
		<NcActionCheckbox v-for="column in timelineColumnOptions"
			:key="column.key"
			:model-value="shownTimelineColumns.includes(column.key)"
			@update:model-value="setTimelineColumn(column.key, $event)">
			{{ tbt(column.label) }}
		</NcActionCheckbox>
		<NcActionSeparator />
		<NcActionCheckbox :model-value="!!view.timelineUndated"
			@update:model-value="setView({ timelineUndated: $event })">
			{{ tbt('Show tasks without dates') }}
		</NcActionCheckbox>
		<template v-if="projects.length">
			<NcActionSeparator />
			<NcActionCaption :name="tbt('Projects')" />
			<NcActionCheckbox v-for="project in projects"
				:key="project.key"
				:model-value="!hiddenProjects.includes(project.key)"
				@update:model-value="setProjectShown(project.key, $event)">
				{{ project.summary }}
			</NcActionCheckbox>
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
import { collectBoardTasks, effectiveLanes, viewKeyForRoute } from '../board.js'
import { tbt } from '../l10n.js'
import { normalizeColumns, setColumnVisible, storableColumns } from '../table.js'
import { DEFAULT_TIMELINE_COLUMNS, TIMELINE_COLUMNS } from '../timeline.js'

import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCaption from '@nextcloud/vue/components/NcActionCaption'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActionRadio from '@nextcloud/vue/components/NcActionRadio'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'

import Restore from 'vue-material-design-icons/Restore.vue'
import TuneVariant from 'vue-material-design-icons/TuneVariant.vue'

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
		isTimeline() {
			return !!this.viewKey && this.view.mode === 'timeline'
		},
		scaleOptions() {
			return [
				{ value: 'week', label: tbt('Week') },
				{ value: 'month', label: tbt('Month') },
				{ value: 'quarter', label: tbt('Quarter') },
			]
		},
		colorOptions() {
			return [
				{ value: 'calendar', label: tbt('List') },
				{ value: 'assignee', label: tbt('Person') },
				{ value: 'status', label: tbt('Status') },
			]
		},
		groupOptions() {
			return [
				{ value: 'none', label: tbt('None') },
				{ value: 'calendar', label: tbt('List'), disabled: !this.isCollection },
				{ value: 'assignee', label: tbt('Person') },
			]
		},
		timelineGroup() {
			const value = this.view.timelineGroup || 'none'
			return value === 'calendar' && !this.isCollection ? 'none' : value
		},
		timelineColumnOptions() {
			return TIMELINE_COLUMNS
		},
		shownTimelineColumns() {
			return Array.isArray(this.view.timelineColumns) ? this.view.timelineColumns : DEFAULT_TIMELINE_COLUMNS
		},
		hiddenProjects() {
			return Array.isArray(this.view.timelineHidden) ? this.view.timelineHidden : []
		},
		/**
		 * The main tasks of the timeline, to show or hide them one by one
		 *
		 * @return {Array}
		 */
		projects() {
			if (!this.isTimeline) {
				return []
			}
			const calendar = this.$route.params.calendarId ? this.$store.getters.getCalendarByRoute(this.$route) : null
			const calendars = this.$route.params.calendarId ? (calendar ? [calendar] : []) : this.$store.getters.getSortedCalendars
			const showClosed = this.$store.getters.tbShowClosed
			return collectBoardTasks({ calendars, collectionId: this.$route.params.collectionId || null, cards: 'root' })
				.filter(task => showClosed || !task.closed)
				.sort((a, b) => a.summary.localeCompare(b.summary))
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
		setTimelineColumn(key, shown) {
			const keys = this.shownTimelineColumns.filter(other => other !== key)
			if (shown) {
				keys.push(key)
			}
			this.setView({ timelineColumns: keys })
		},
		setProjectShown(key, shown) {
			const hidden = this.hiddenProjects.filter(other => other !== key)
			if (!shown) {
				hidden.push(key)
			}
			this.setView({ timelineHidden: hidden })
		},
		setListStyle(listStyle) {
			this.$store.dispatch('setTbPrefs', { listStyle })
		},
	},
}
</script>
