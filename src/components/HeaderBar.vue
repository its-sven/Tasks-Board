<!--
Nextcloud - Tasks

@author Raimund Schlüßler
@copyright 2021 Raimund Schlüßler <raimund.schluessler@mailbox.org>

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
	<div class="header">
		<div v-if="$route.params.collectionId !== 'completed' && calendar && !calendar.readOnly"
			class="header__input">
			<NcTextField ref="input"
				v-model="newTaskName"
				:label="placeholder"
				:placeholder="placeholder"
				autocomplete="off"
				class="reactive"
				trailing-button-icon="arrowEnd"
				:show-trailing-button="newTaskName !== ''"
				:trailing-button-label="placeholder"
				@trailing-button-click="addTask"
				@compositionstart="compositionstart()"
				@compositionend="compositionend()"
				@keydown.esc="clearNewTask($event)"
				@keydown.enter="addTask"
				@paste.stop="addMultipleTasks">
				<template #icon>
					<Plus :size="20" />
				</template>
			</NcTextField>
			<!-- Tasks Board: choose the list new tasks are added to -->
			<TbTargetListPicker @chosen="focusInput" />
			<!-- Tasks Board: copy a template with its subtasks -->
			<TbTemplateButton />
		</div>
		<TbViewSwitch />
		<FilterDropdown />
		<TbSortDropdown />
		<TbBoardOptions />
		<TbClosedToggle />
		<TbSelectionToggle />
		<TbSelectionBar />
		<CreateMultipleTasksDialog v-if="showCreateMultipleTasksModal"
			:calendar="calendar"
			:tasks-to-create="multipleTasks"
			:tasks-additional-properties="additionalTaskProperties"
			@cancel="createMultipleTasksCancelled"
			@close="createMultipleTasksSuccessful" />
	</div>
</template>

<script>
import FilterDropdown from './FilterDropdown.vue'
import TbSortDropdown from '../tb/components/TbSortDropdown.vue'
import TbBoardOptions from '../tb/components/TbBoardOptions.vue'
import TbClosedToggle from '../tb/components/TbClosedToggle.vue'
import TbViewSwitch from '../tb/components/TbViewSwitch.vue'
import { tbt } from '../tb/l10n.js'
import { currentPerson } from '../tb/store/assignment.js'
import TbTargetListPicker from '../tb/components/TbTargetListPicker.vue'
import TbSelectionBar from '../tb/components/TbSelectionBar.vue'
import TbSelectionToggle from '../tb/components/TbSelectionToggle.vue'
import TbTemplateButton from '../tb/components/TbTemplateButton.vue'
import { showSuccess } from '@nextcloud/dialogs'
import openNewTask from '../mixins/openNewTask.js'

import { translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
import NcTextField from '@nextcloud/vue/components/NcTextField'

import Plus from 'vue-material-design-icons/Plus.vue'

import { mapGetters, mapActions } from 'vuex'

import { textToTask } from '../utils/textToTask.js'
import CreateMultipleTasksDialog from './CreateMultipleTasksDialog.vue'

export default {
	components: {
		CreateMultipleTasksDialog,
		NcTextField,
		FilterDropdown,
		TbBoardOptions,
		TbClosedToggle,
		TbTargetListPicker,
		TbSelectionBar,
		TbSelectionToggle,
		TbSortDropdown,
		TbTemplateButton,
		TbViewSwitch,
		Plus,
	},
	mixins: [openNewTask],
	data() {
		return {
			newTaskName: '',
			showCreateMultipleTasksModal: false,
			multipleTasks: { numberOfTasks: 0, tasks: {} },
			additionalTaskProperties: {},
			compositing: false,
		}
	},
	computed: {
		calendar() {
			// Tasks Board: the list chosen next to the input (default: this list or the default list)
			return this.$store.getters.tbTargetCalendar(this.$route) || this.getCalendarByRoute(this.$route)
		},
		/** Tasks Board: whether the new task goes to another list than the one shown */
		tbOtherList() {
			return !!this.$route.params.calendarId && this.calendar?.id !== this.$route.params.calendarId
		},
		...mapGetters({
			getCalendarByRoute: 'getCalendarByRoute',
		}),

		placeholder() {
			switch (this.$route.params.collectionId) {
			case 'starred':
				return t('tasks', 'Add an important task to "{calendar}"…', { calendar: this.calendar.displayName }, undefined, { sanitize: false, escape: false })
			case 'week':
			case 'today':
				return t('tasks', 'Add a task due today to "{calendar}"…', { calendar: this.calendar.displayName }, undefined, { sanitize: false, escape: false })
			case 'current':
				return t('tasks', 'Add a current task to "{calendar}"…', { calendar: this.calendar.displayName }, undefined, { sanitize: false, escape: false })
			// Tasks Board: new tasks in "Assigned to me" are assigned to the current user
			case 'assigned':
				return tbt('Add a task assigned to me to "{calendar}"…', { calendar: this.calendar.displayName })
			case 'waiting':
				return tbt('Add a waiting task (follow-up in a week) to "{calendar}"…', { calendar: this.calendar.displayName })
			case 'followup':
				return tbt('Add a follow-up for today to "{calendar}"…', { calendar: this.calendar.displayName })
			default:
				return t('tasks', 'Add a task to "{calendar}"…', { calendar: this.calendar.displayName }, undefined, { sanitize: false, escape: false })
			}
		},
	},
	methods: {
		...mapActions([
			'createTask',
		]),

		focusInput() {
			this.$refs.input?.$refs?.inputField?.$refs?.input?.focus()
		},

		compositionstart() {
			this.compositing = true
		},
		compositionend() {
			this.compositing = false
		},

		clearNewTask(event) {
			if (this.compositing) {
				return
			}

			event.target.blur()
			this.newTaskName = ''
		},

		async addTask() {
			if (this.compositing) {
				return
			}

			const data = {
				summary: this.newTaskName,
				// Tasks Board: always the chosen list
				calendar: this.calendar,
				...this.getAdditionalTaskProperties(),
			}
			const task = await this.createTask(data)
			if (this.tbOtherList) {
				// The task is not shown in this list, so don't open it
				showSuccess(tbt('Task added to "{list}".', { list: this.calendar.displayName }))
			} else {
				await this.openNewTask(task)
			}
			this.newTaskName = ''
			this.$refs.input.$refs.inputField.$refs.input.focus()
		},

		getAdditionalTaskProperties() {
			const taskProperties = {}
			// If the task is created in a collection view,
			// set the appropriate properties.
			if (this.$route.params.collectionId === 'starred') {
				taskProperties.priority = 1
			}
			if (this.$route.params.collectionId === 'today'
				|| this.$route.params.collectionId === 'week') {
				taskProperties.due = moment().startOf('day').format('YYYY-MM-DDTHH:mm:ss')
				taskProperties.allDay = this.$store.state.settings.settings.allDay
			}
			if (this.$route.params.collectionId === 'current') {
				taskProperties.start = moment().format('YYYY-MM-DDTHH:mm:ss')
			}
			if (this.$route.params.collectionId === 'assigned') {
				taskProperties.tbAssignee = currentPerson(this.$store.getters)
			}
			if (this.$route.params.collectionId === 'waiting') {
				taskProperties.tbWaitDays = 7
			}
			if (this.$route.params.collectionId === 'followup') {
				taskProperties.tbWaitDays = 0
			}
			return taskProperties
		},

		addMultipleTasks($event) {
			const pastedText = $event.clipboardData.getData('text')
			const tasksFromText = textToTask(pastedText)

			if (tasksFromText.numberOfTasks <= 1) {
				return
			}

			this.multipleTasks = tasksFromText
			this.showCreateMultipleTasksModal = true
			this.additionalTaskProperties = this.getAdditionalTaskProperties()
		},

		async createMultipleTasksCancelled() {
			this.showCreateMultipleTasksModal = false
			this.multipleTasks = { numberOfTasks: 0, tasks: {} }
			this.additionalTaskProperties = {}
			await this.$nextTick()
			this.$refs.input.$refs.inputField.$refs.input.focus()
		},

		async createMultipleTasksSuccessful() {
			this.showCreateMultipleTasksModal = false
			this.multipleTasks = { numberOfTasks: 0, tasks: {} }
			this.additionalTaskProperties = {}
			this.newTaskName = ''
			await this.$nextTick()
			this.$refs.input.$refs.inputField.$refs.input.focus()
		},
	},
}
</script>

<style lang="scss" scoped>
// mobile breakpoint
$breakpoint-mobile: 1024px;

.header {
	padding: calc(2* var(--default-grid-baseline));
	padding-left: calc(4 * var(--default-grid-baseline) + var(--default-clickable-area)); // leave space for the app-nav-toggle
	position: sticky;
	background-color: var(--color-background-dark);
	z-index: 1000;
	display: flex;
	top: 0;

	@media only screen and (max-width: $breakpoint-mobile) {
		padding-right: 0;
		padding-left: calc(2 * var(--default-grid-baseline) + var(--default-clickable-area));
	}

	&__input {
		position: relative;
		width: 100%;
		margin-right: calc(2 * var(--default-grid-baseline));

		.input-field {
			margin-block-start: 0 !important;
		}
	}

	.filter {
		margin-left: auto;
	}
}
</style>
