<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
List view with groups (status, tag or priority level).
Uses the upstream task rows, so everything works as in the normal list,
except dragging between groups (switched off, the groups come from the task data).
-->
<template>
	<div>
		<HeaderBar />
		<div class="task-list tb-grouped">
			<div v-for="group in groups"
				:key="group.key"
				class="grouped-tasks">
				<h2 class="heading tb-grouped__heading">
					<TbAvatar v-if="group.type === 'assignee'" :person="{ uid: group.uid, displayName: group.value }" :size="22" />
					<span class="heading__name">{{ groupTitle(group) }}</span>
					<span class="tb-grouped__count">{{ group.tasks.length }}</span>
				</h2>
				<TaskDragContainer :tasks="group.tasks"
					:disabled="true"
					:collection-string="collectionId || null"
					:calendar-id="calendar ? calendar.id : null"
					:collection-id="collectionId || 'uncompleted'" />
			</div>
			<p v-if="!groups.length" class="tb-grouped__empty">
				{{ tbt('No tasks') }}
			</p>

			<!-- Completed tasks of a single list, as in the upstream list (loaded by the header button) -->
			<div v-if="calendar" class="grouped-tasks">
				<NcButton v-if="closedCount(calendar.id)"
					alignment="center-reverse"
					variant="tertiary"
					class="reactive heading"
					@click="toggleHidden">
					<template #icon>
						<ChevronUp v-if="showHidden" />
						<ChevronDown v-else />
					</template>
					{{ closedCountString }}
				</NcButton>
				<TaskDragContainer v-if="showHidden"
					:tasks="closedRootTasks(calendar.tasks)"
					:calendar-id="calendar.id"
					:disabled="calendar.readOnly"
					class="completed"
					collection-id="completed" />
				<DeleteCompletedModal v-if="calendar.loadedCompleted && !calendar.readOnly" :calendar="calendar" />
			</div>
			<LoadCompletedButton v-else-if="collectionId === 'completed'" :calendars="calendars" />
			<!-- Recently closed tasks of a collection, shown with the button in the header -->
			<div v-else-if="closedOfCollection.length" class="grouped-tasks">
				<p class="tb-closed-heading">
					{{ tbt('Completed tasks of the last {days} days', { days: recentDays }) }}
				</p>
				<TaskDragContainer :tasks="closedOfCollection"
					:disabled="true"
					class="completed"
					:collection-string="collectionId"
					:collection-id="collectionId" />
			</div>
		</div>
	</div>
</template>

<script>
import DeleteCompletedModal from '../../components/DeleteCompletedModal.vue'
import HeaderBar from '../../components/HeaderBar.vue'
import LoadCompletedButton from '../../components/LoadCompletedButton.vue'
import TaskDragContainer from '../../components/TaskDragContainer.vue'
import { isParentInList, isTaskInList } from '../../store/storeHelper.js'
import { closedTasksOfCollection, RECENTLY_CLOSED_DAYS } from '../board.js'
import { tbt } from '../l10n.js'
import { groupTasks } from '../sort.js'
import TbAvatar from './TbAvatar.vue'
import '../../views/AppContent/task-list.scss'

import { translatePlural as n } from '@nextcloud/l10n'
import NcButton from '@nextcloud/vue/components/NcButton'

import ChevronDown from 'vue-material-design-icons/ChevronDown.vue'
import ChevronUp from 'vue-material-design-icons/ChevronUp.vue'

import { mapGetters } from 'vuex'

export default {
	name: 'TbGroupedList',
	components: {
		ChevronDown,
		ChevronUp,
		DeleteCompletedModal,
		HeaderBar,
		LoadCompletedButton,
		NcButton,
		TbAvatar,
		TaskDragContainer,
	},
	props: {
		/** The list, or null in a collection */
		calendar: {
			type: Object,
			default: null,
		},
		/** The collection, or null for a single list */
		collectionId: {
			type: String,
			default: null,
		},
		grouping: {
			type: String,
			required: true,
		},
	},
	computed: {
		...mapGetters({
			calendars: 'getSortedCalendars',
			closedCount: 'getCalendarCountClosed',
			openRootTasks: 'findOpenRootTasks',
			closedRootTasks: 'findClosedRootTasks',
		}),
		tasks() {
			if (this.calendar) {
				return this.openRootTasks(this.calendar.tasks)
			}
			const tasks = []
			for (const calendar of this.calendars) {
				for (const task of Object.values(calendar.tasks)) {
					if (isTaskInList(task, this.collectionId) && (!task.related || !isParentInList(task, calendar.tasks))) {
						tasks.push(task)
					}
				}
			}
			return tasks
		},
		groups() {
			return groupTasks(this.tasks, this.grouping)
		},
		closedOfCollection() {
			if (this.calendar || !this.collectionId || !this.$store.getters.tbShowClosed) {
				return []
			}
			return this.calendars.flatMap(calendar => closedTasksOfCollection(calendar, this.collectionId))
		},
		recentDays() {
			return RECENTLY_CLOSED_DAYS
		},
		showHidden: {
			get() {
				return this.$store.state.settings.settings.showHidden
			},
			set(value) {
				this.$store.dispatch('setSetting', { type: 'showHidden', value })
			},
		},
		closedCountString() {
			return n('tasks', '%n Completed Task', '%n Completed Tasks', this.closedCount(this.calendar.id))
		},
	},
	methods: {
		tbt,
		toggleHidden() {
			this.showHidden = +!this.showHidden
		},
		groupTitle(group) {
			switch (group.type) {
			case 'status':
				return {
					open: tbt('Open'),
					inProgress: tbt('In progress'),
					waiting: tbt('Waiting'),
					done: tbt('Done'),
					cancelled: tbt('Cancelled'),
				}[group.value]
			case 'priority':
				return {
					high: tbt('Important (1–4)'),
					medium: tbt('Normal (5)'),
					low: tbt('Someday (6–9)'),
					none: tbt('No priority'),
				}[group.value]
			case 'tag':
				return group.value
			case 'tagNone':
				return tbt('Without tag')
			case 'assignee':
				return group.value
			case 'assigneeNone':
				return tbt('Not assigned')
			default:
				return ''
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-grouped {
	&__heading {
		display: flex;
		gap: calc(2 * var(--default-grid-baseline));
		align-items: baseline;
	}

	&__count {
		color: var(--color-text-maxcontrast);
		font-weight: normal;
		font-size: var(--font-size-small, 13px);
	}

	&__empty {
		color: var(--color-text-maxcontrast);
		text-align: center;
		margin-top: calc(6 * var(--default-grid-baseline));
	}
}
</style>
