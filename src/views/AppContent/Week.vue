<!--
Nextcloud - Tasks

@author Raimund Schlüßler
@copyright 2021 Raimund Schlüßler <raimund.schluessler@mailbox.org>
@copyright 2018 Vadim Nicolai <contact@vadimnicolai.com>

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
License as published by the Free Software Foundation; either
version 3 of the License, or any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU AFFERO GENERAL PUBLIC LICENSE for more details.

You should have received a copy of the GNU Affero General Public
License along with this library. If not, see <http://www.gnu.org/licenses/>.

-->

<template>
	<div>
		<HeaderBar />
		<div class="task-list">
			<div v-for="day in days"
				:key="day.diff"
				:day="day.diff"
				class="grouped-tasks ui-droppable">
				<h2 class="heading">
					<span class="heading__name">{{ dayString(day.diff) }}</span>
				</h2>
				<TaskDragContainer :tasks="day.tasks"
					:collection-string="`week-${day.diff}`"
					:collection-id="`week-${day.diff}`" />
			</div>
			<!-- Tasks Board: recently closed tasks, shown with the button in the header -->
			<div v-if="tbClosedTasks.length" class="grouped-tasks">
				<h2 class="heading">
					<span class="heading__name">{{ tbt('Completed tasks of the last {days} days', { days: tbRecentDays }) }}</span>
				</h2>
				<TaskDragContainer :tasks="tbClosedTasks"
					:disabled="true"
					class="completed"
					collection-string="week"
					collection-id="week" />
			</div>
		</div>
	</div>
</template>

<script>
import HeaderBar from '../../components/HeaderBar.vue'
import TaskDragContainer from '../../components/TaskDragContainer.vue'
import { isTaskInList } from '../../store/storeHelper.js'
import { closedTasksOfCollection, RECENTLY_CLOSED_DAYS } from '../../tb/board.js'
import { tbt } from '../../tb/l10n.js'
import './task-list.scss'

import { translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'

import { mapGetters } from 'vuex'

export default {
	components: {
		HeaderBar,
		TaskDragContainer,
	},
	computed: {
		...mapGetters({
			tasks: 'getAllTasks',
			openRootTasks: 'findOpenRootTasks',
		}),

		/**
		 * Tasks Board: main tasks closed in the last days, shown with the button in the header
		 *
		 * @return {Array} The tasks
		 */
		tbClosedTasks() {
			if (!this.$store.getters.tbShowClosed) {
				return []
			}
			return this.$store.getters.getSortedCalendars.flatMap(calendar => closedTasksOfCollection(calendar, 'week'))
		},

		tbRecentDays() {
			return RECENTLY_CLOSED_DAYS
		},

		/**
		 * Returns an array with an entry for every day which has tasks for this day.
		 *
		 * @return {Array} the array with the days
		 */
		days() {
			// Get all open root tasks
			const tasks = this.openRootTasks(this.tasks)

			// Construct array with days for the current week.
			const days = []
			for (let day = 0; day < 8; day++) {
				days.push({ diff: day, tasks: [] })

				tasks.forEach(task => {
					// Add the task to the respective day if it is within the next week.
					if (isTaskInList(task, `week-${day}`)) {
						days[day].tasks.push(task)
					}
				})
			}

			// Remove all days without tasks.
			return days.filter(day => day.tasks.length)
		},
	},
	methods: {
		tbt,
		dayString(day) {
			const date = moment().add(day, 'day')
			let dayString
			if (day === 0) {
				dayString = t('tasks', 'Today')
			} else if (day === 1) {
				dayString = t('tasks', 'Tomorrow')
			} else {
				dayString = date.format('dddd')
			}
			return dayString + ', ' + date.format('LL')
		},
	},
}
</script>
