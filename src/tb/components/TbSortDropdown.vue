<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Replaces the upstream SortorderDropdown in the header:
same sort orders plus "Status" and "Progress", saved per list,
plus grouping and a separate sort order for subtasks.
-->
<template>
	<NcActions class="sortorder tb-sort reactive"
		:title="t('tasks', 'Change sort order')"
		:aria-label="t('tasks', 'Change sort order')">
		<template #icon>
			<span class="material-design-icon tb-sort__icon">
				<component :is="currentIcon" :size="20" />
				<MenuDown v-if="sortDirection" class="tb-sort__direction" :size="18" />
				<MenuUp v-else class="tb-sort__direction" :size="18" />
			</span>
		</template>
		<NcActionCaption :name="tbt('Sort by – this list')" />
		<NcActionButton v-for="order in orders"
			:key="order.id"
			:title="order.hint"
			:class="{ 'tb-sort__selected': sortOrder === order.id }"
			:close-after-click="true"
			@click="setSortOrder(order.id)">
			<template #icon>
				<component :is="order.icon" :size="20" />
			</template>
			{{ order.text }}{{ sortOrder === order.id ? (sortDirection ? ' ↓' : ' ↑') : '' }}
		</NcActionButton>
		<template v-if="isList">
			<NcActionSeparator />
			<NcActionCaption :name="tbt('Group by')" />
			<NcActionRadio v-for="option in groupings"
				:key="option.value"
				name="tb-grouping"
				:value="option.value"
				:model-value="grouping"
				@update:model-value="setView({ grouping: option.value })">
				{{ option.label }}
			</NcActionRadio>
			<NcActionSeparator />
			<NcActionCaption :name="tbt('Subtasks')" />
			<NcActionRadio v-for="option in subtaskOrders"
				:key="option.value"
				name="tb-subtask-order"
				:value="option.value"
				:model-value="subtaskOrder"
				@update:model-value="setView({ subtaskOrder: option.value })">
				{{ option.label }}
			</NcActionRadio>
		</template>
	</NcActions>
</template>

<script>
import { tbt } from '../l10n.js'
import { viewKeyForRoute } from '../board.js'
import { GROUPINGS, sortKeyForRoute } from '../sort.js'

import { translate as t } from '@nextcloud/l10n'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCaption from '@nextcloud/vue/components/NcActionCaption'
import NcActionRadio from '@nextcloud/vue/components/NcActionRadio'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'

import AccountOutline from 'vue-material-design-icons/AccountOutline.vue'
import AnimationOutline from 'vue-material-design-icons/AnimationOutline.vue'
import Bookmark from 'vue-material-design-icons/BookmarkOutline.vue'
import CalendarEnd from 'vue-material-design-icons/CalendarEnd.vue'
import CalendarStart from 'vue-material-design-icons/CalendarStart.vue'
import Check from 'vue-material-design-icons/Check.vue'
import FileTreeOutline from 'vue-material-design-icons/FileTreeOutline.vue'
import FormatListBulleted from 'vue-material-design-icons/FormatListBulleted.vue'
import ListStatus from 'vue-material-design-icons/ListStatus.vue'
import MenuDown from 'vue-material-design-icons/MenuDown.vue'
import MenuUp from 'vue-material-design-icons/MenuUp.vue'
import OrderAlphabeticalAscending from 'vue-material-design-icons/OrderAlphabeticalAscending.vue'
import Pencil from 'vue-material-design-icons/PencilOutline.vue'
import PercentOutline from 'vue-material-design-icons/PercentOutline.vue'
import Plus from 'vue-material-design-icons/Plus.vue'
import Star from 'vue-material-design-icons/StarOutline.vue'
import TagMultiple from 'vue-material-design-icons/TagMultipleOutline.vue'

import { mapGetters } from 'vuex'

export default {
	name: 'TbSortDropdown',
	components: {
		AccountOutline,
		AnimationOutline,
		FileTreeOutline,
		FormatListBulleted,
		Bookmark,
		CalendarEnd,
		CalendarStart,
		Check,
		ListStatus,
		MenuDown,
		MenuUp,
		NcActionButton,
		NcActionCaption,
		NcActionRadio,
		NcActionSeparator,
		NcActions,
		OrderAlphabeticalAscending,
		Pencil,
		PercentOutline,
		Plus,
		Star,
		TagMultiple,
	},
	computed: {
		...mapGetters({
			sortOrder: 'sortOrder',
			sortDirectionValue: 'sortDirection',
			grouping: 'tbGrouping',
			subtaskOrder: 'tbSubtaskOrder',
		}),
		sortDirection() {
			return !!this.sortDirectionValue
		},
		key() {
			return sortKeyForRoute(this.$route)
		},
		mode() {
			const viewKey = viewKeyForRoute(this.$route)
			return viewKey ? this.$store.getters.tbView(viewKey).mode : 'list'
		},
		isList() {
			return this.mode === 'list'
		},
		orders() {
			return [
				{ id: 'default', icon: 'Bookmark', text: t('tasks', 'Relevance'), hint: t('tasks', 'Sort by completed state, due date, priority, start date and summary.') },
				{ id: 'status', icon: 'ListStatus', text: tbt('Status'), hint: tbt('In progress, open, waiting, done – then priority') },
				{ id: 'priority', icon: 'Star', text: t('tasks', 'Priority'), hint: t('tasks', 'Sort by priority and summary.') },
				{ id: 'progress', icon: 'PercentOutline', text: tbt('Progress'), hint: tbt('Most advanced first') },
				{ id: 'assignee', icon: 'AccountOutline', text: tbt('Person'), hint: tbt('By assigned person, unassigned last') },
				{ id: 'start', icon: 'CalendarStart', text: t('tasks', 'Start date'), hint: t('tasks', 'Sort by start date, priority and summary.') },
				{ id: 'due', icon: 'CalendarEnd', text: t('tasks', 'Due date'), hint: t('tasks', 'Sort by due date, priority and summary.') },
				{ id: 'created', icon: 'Plus', text: t('tasks', 'Created date'), hint: t('tasks', 'Sort by created date, priority and summary.') },
				{ id: 'modified', icon: 'Pencil', text: t('tasks', 'Last modified'), hint: t('tasks', 'Sort by last-modified date, priority and summary.') },
				{ id: 'completedDate', icon: 'Check', text: t('tasks', 'Completed date'), hint: t('tasks', 'Sort by completed date, priority and summary.') },
				{ id: 'alphabetically', icon: 'OrderAlphabeticalAscending', text: t('tasks', 'Alphabetically'), hint: t('tasks', 'Sort by summary and priority.') },
				{ id: 'tags', icon: 'TagMultiple', text: t('tasks', 'Tags'), hint: t('tasks', 'Sort by tags.') },
				{ id: 'manual', icon: 'AnimationOutline', text: t('tasks', 'Manually'), hint: t('tasks', 'Sort by manual order.') },
				// Table only: by the list and main task columns
				...(this.mode === 'table'
					? [
						{ id: 'calendar', icon: 'FormatListBulleted', text: tbt('List'), hint: tbt('By list name') },
						{ id: 'parent', icon: 'FileTreeOutline', text: tbt('Main task'), hint: tbt('Subtasks below their main task') },
					]
					: []),
			]
		},
		currentIcon() {
			return this.orders.find(order => order.id === this.sortOrder)?.icon || 'Bookmark'
		},
		groupings() {
			const labels = {
				none: tbt('None'),
				status: tbt('Status'),
				tag: tbt('Tag'),
				priority: tbt('Priority level'),
				assignee: tbt('Person'),
			}
			return GROUPINGS.map(value => ({ value, label: labels[value] }))
		},
		subtaskOrders() {
			return [
				{ value: 'inherit', label: tbt('Like main tasks') },
				{ value: 'manual', label: t('tasks', 'Manually') },
				{ value: 'alphabetically', label: tbt('Alphabetically (01, 02 …)') },
				{ value: 'priority', label: t('tasks', 'Priority') },
				{ value: 'status', label: tbt('Status') },
			]
		},
	},
	methods: {
		t,
		tbt,
		setView(patch) {
			if (this.key) {
				this.$store.dispatch('setTbView', { key: this.key, patch })
			}
		},
		setSortOrder(order) {
			// Same as upstream: selecting the current order toggles the direction
			const direction = this.sortOrder === order ? !this.sortDirection : false
			this.setView({ sortOrder: order, sortDirection: direction })
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-sort {
	&__icon {
		position: relative;
		width: 44px;
		height: 44px;
	}

	&__direction {
		position: absolute;
		top: 0;
		right: 0;
	}

	&__selected :deep(.action-button) {
		font-weight: bold;
	}
}
</style>
