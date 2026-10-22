<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Table view (like the grid of Planner): one row per task, columns can be shown,
hidden and moved (drag the header), a click on a header sorts. Status, priority,
person and due date can be changed directly in the cell.
-->
<template>
	<div class="tb-table-view">
		<div ref="scroller" class="tb-table" :style="{ maxHeight }">
			<table class="tb-table__table" :aria-label="tbt('Tasks')">
				<thead>
					<tr ref="headRow" class="tb-table__head">
						<th v-for="column in columns"
							:key="column.key"
							:class="['tb-table__th', 'tb-table__th--' + column.key, { 'tb-table__th--fixed': column.fixed, 'tb-table__th--sorted': isSorted(column) }]"
							:aria-sort="ariaSort(column)"
							scope="col">
							<button v-if="column.sort"
								type="button"
								class="tb-table__sort"
								:title="tbt('Sort by {column}', { column: tbt(column.label) })"
								@click="sortBy(column)">
								<span>{{ tbt(column.label) }}</span>
								<MenuDown v-if="isSorted(column) && sortDirection" :size="18" />
								<MenuUp v-else-if="isSorted(column)" :size="18" />
							</button>
							<span v-else class="tb-table__sort tb-table__sort--plain">{{ tbt(column.label) }}</span>
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="task in rows"
						:key="task.key"
						:data-task-key="task.key"
						class="tb-table__row"
						:class="{
							'tb-table__row--active': task.uri === $route.params.taskId,
							'tb-table__row--selected': $store.getters.isTbSelected(task.key),
							'tb-table__row--closed': task.closed,
						}"
						@click="onRowClick(task, $event)">
						<td v-for="column in columns"
							:key="column.key"
							:class="['tb-table__td', 'tb-table__td--' + column.key]">
							<!-- Task -->
							<div v-if="column.key === 'summary'" class="tb-table__summary">
								<TaskCheckbox class="tb-table__check no-nav"
									:completed="task.completed"
									:cancelled="task.status === 'CANCELLED'"
									:read-only="isReadOnly(task)"
									:priority-class="priorityClass(task)"
									@click.stop
									@toggle-completed="toggleCompleted(task)" />
								<span class="tb-table__title" :title="task.summary">{{ task.summary }}</span>
							</div>
							<!-- Person -->
							<button v-else-if="column.key === 'assignee'"
								type="button"
								class="tb-table__cell-button"
								:disabled="isReadOnly(task)"
								:aria-label="tbt('Assigned to') + ': ' + (assignee(task)?.displayName || tbt('Not assigned'))"
								@click.stop="openMenu('assignee', task, $event)">
								<TbAvatar v-if="assignee(task)"
									:person="assignee(task)"
									:size="24"
									:show-name="true" />
								<span v-else class="tb-table__empty">–</span>
							</button>
							<!-- Start / follow-up -->
							<span v-else-if="column.key === 'start'"
								class="tb-table__date"
								:class="{ 'tb-table__date--waiting': isWaiting(task), 'tb-table__date--overdue': isFollowUp(task) && task.startMoment.isValid() }">
								<TimerSandEmpty v-if="isWaiting(task)" :size="14" />
								{{ formatDate(task.startMoment) }}
							</span>
							<!-- Due -->
							<button v-else-if="column.key === 'due'"
								type="button"
								class="tb-table__cell-button"
								:disabled="isReadOnly(task)"
								:aria-label="tbt('Due') + ': ' + (formatDate(task.dueMoment) || '–')"
								@click.stop="openMenu('due', task, $event)">
								<span class="tb-table__date" :class="{ 'tb-table__date--overdue': isOverdue(task) }">
									{{ formatDate(task.dueMoment) || '–' }}
								</span>
							</button>
							<!-- List -->
							<span v-else-if="column.key === 'calendar'" class="tb-table__list">
								<span class="tb-table__dot" :style="{ 'background-color': task.calendar.color }" />
								<span class="tb-table__ellipsis">{{ task.calendar.displayName }}</span>
							</span>
							<!-- Main task -->
							<span v-else-if="column.key === 'parent'" class="tb-table__ellipsis tb-table__muted" :title="parent(task)?.summary">
								{{ parent(task)?.summary || '–' }}
							</span>
							<!-- Status -->
							<button v-else-if="column.key === 'status'"
								type="button"
								class="tb-table__cell-button"
								:disabled="isReadOnly(task)"
								:aria-label="tbt('Status') + ': ' + statusLabel(task)"
								@click.stop="openMenu('status', task, $event)">
								<span class="tb-table__status" :class="'tb-table__status--' + stateOf(task)">
									<component :is="statusIcon(task)" :size="16" />
									{{ statusLabel(task) }}
								</span>
							</button>
							<!-- Priority -->
							<button v-else-if="column.key === 'priority'"
								type="button"
								class="tb-table__cell-button"
								:disabled="isReadOnly(task)"
								:aria-label="tbt('Priority') + ': ' + priorityLabel(task)"
								@click.stop="openMenu('priority', task, $event)">
								<span v-if="priorityOf(task) === 'none'" class="tb-table__empty">–</span>
								<span v-else class="tb-table__priority" :class="'tb-table__priority--' + priorityOf(task)">
									<span class="tb-table__dot" />
									{{ priorityLabel(task) }}
								</span>
							</button>
							<!-- Tags -->
							<span v-else-if="column.key === 'tags'" class="tb-table__tags">
								<span v-for="tag in visibleTags(task)" :key="tag" class="tb-chip">{{ tag }}</span>
								<span v-if="task.tags.length > 3" class="tb-table__muted">+{{ task.tags.length - 3 }}</span>
							</span>
							<!-- Progress -->
							<span v-else-if="column.key === 'progress'" class="tb-table__progress">
								<span class="tb-table__bar"><span :style="{ width: (task.completed ? 100 : task.complete) + '%' }" /></span>
								<span class="tb-table__muted">{{ task.completed ? 100 : task.complete }} %</span>
							</span>
							<!-- Overview -->
							<span v-else-if="column.key === 'overview'" class="tb-table__overview">
								<NoteTextOutline v-if="task.note" :size="16" :title="tbt('Has notes')" />
								<BellOutline v-if="task.alarms && task.alarms.length" :size="16" :title="tbt('Has reminders')" />
								<span v-if="subtaskCount(task).total" class="tb-table__subcount" :title="tbt('Subtasks done')">
									<CheckboxMarkedOutline :size="16" />
									{{ subtaskCount(task).done }}/{{ subtaskCount(task).total }}
								</span>
							</span>
							<!-- Created / modified -->
							<span v-else-if="column.key === 'created'" class="tb-table__date">{{ formatDate(task.createdMoment) }}</span>
							<span v-else-if="column.key === 'modified'" class="tb-table__date">{{ formatDate(task.modifiedMoment) }}</span>
						</td>
					</tr>
				</tbody>
			</table>
			<p v-if="!rows.length" class="tb-table__empty-state">
				{{ tbt('No tasks') }}
			</p>
		</div>
		<NcButton v-if="view.tableShowClosed && !completedLoaded"
			class="tb-table__load"
			variant="tertiary"
			:disabled="loadingCompleted"
			@click="loadCompleted">
			<template #icon>
				<CloudDownloadOutline :size="18" />
			</template>
			{{ tbt('Load completed tasks') }}
		</NcButton>

		<TbTableMenu v-if="menu"
			:anchor="menu.anchor"
			:items="menuItems"
			:title="menuTitle"
			:loading="menu.type === 'assignee' && peopleLoading"
			@select="onMenuSelect"
			@close="menu = null">
			<label v-if="menu.type === 'due'" class="tb-table__date-pick">
				<span>{{ tbt('Pick a date') }}</span>
				<input type="date"
					:value="isoDate(menu.task.dueMoment)"
					@change="pickDate($event.target.value)">
			</label>
		</TbTableMenu>
		<TbWaitDialog v-if="pendingWait"
			:task="pendingWait"
			@confirm="confirmWait"
			@cancel="pendingWait = null" />
	</div>
</template>

<script>
import TaskCheckbox from '../../components/TaskCheckbox.vue'
import { boardColumn, collectBoardTasks, parentTask, priorityGroup } from '../board.js'
import { tbt } from '../l10n.js'
import { sort as tbSort } from '../sort.js'
import { assigneeOf } from '../assignee.js'
import { isTaskReadOnly } from '../store/board.js'
import { handleSelectClick } from '../store/selection.js'
import { moveColumn, normalizeColumns, shownColumns, storableColumns } from '../table.js'
import { isFollowUpDue } from '../waiting.js'
import TbAvatar from './TbAvatar.vue'
import TbTableMenu from './TbTableMenu.vue'
import TbWaitDialog from './TbWaitDialog.vue'

import { showError } from '@nextcloud/dialogs'
import moment from '@nextcloud/moment'
import NcButton from '@nextcloud/vue/components/NcButton'

import AccountOffOutline from 'vue-material-design-icons/AccountOffOutline.vue'
import BellOutline from 'vue-material-design-icons/BellOutline.vue'
import CalendarRemoveOutline from 'vue-material-design-icons/CalendarRemoveOutline.vue'
import CalendarToday from 'vue-material-design-icons/CalendarToday.vue'
import CheckboxMarkedOutline from 'vue-material-design-icons/CheckboxMarkedOutline.vue'
import CheckCircle from 'vue-material-design-icons/CheckCircle.vue'
import CircleHalfFull from 'vue-material-design-icons/CircleHalfFull.vue'
import CircleOutline from 'vue-material-design-icons/CircleOutline.vue'
import CloseCircleOutline from 'vue-material-design-icons/CloseCircleOutline.vue'
import CloudDownloadOutline from 'vue-material-design-icons/CloudDownloadOutline.vue'
import MenuDown from 'vue-material-design-icons/MenuDown.vue'
import MenuUp from 'vue-material-design-icons/MenuUp.vue'
import NoteTextOutline from 'vue-material-design-icons/NoteTextOutline.vue'
import TimerSandEmpty from 'vue-material-design-icons/TimerSandEmpty.vue'

import SortableJS from 'sortablejs'
import { mapGetters } from 'vuex'

const STATUS = {
	open: { label: 'Open', icon: CircleOutline },
	inProgress: { label: 'In progress', icon: CircleHalfFull },
	waiting: { label: 'Waiting', icon: TimerSandEmpty },
	done: { label: 'Done', icon: CheckCircle },
	cancelled: { label: 'Cancelled', icon: CloseCircleOutline },
}

const PRIORITY = {
	high: { label: 'Important', value: 1 },
	medium: { label: 'Normal', value: 5 },
	low: { label: 'Someday', value: 9 },
	none: { label: 'No priority', value: 0 },
}

const PRIORITY_COLORS = { high: 'var(--tb-prio-high)', medium: 'var(--tb-prio-medium)', low: 'var(--tb-prio-low)', none: 'var(--color-text-maxcontrast)' }

export default {
	name: 'TbTable',
	components: {
		BellOutline,
		CheckboxMarkedOutline,
		CloudDownloadOutline,
		MenuDown,
		MenuUp,
		NcButton,
		NoteTextOutline,
		TbAvatar,
		TbTableMenu,
		TbWaitDialog,
		TaskCheckbox,
		TimerSandEmpty,
	},
	props: {
		calendars: {
			type: Array,
			required: true,
		},
		collectionId: {
			type: String,
			default: null,
		},
		viewKey: {
			type: String,
			required: true,
		},
	},
	data() {
		return {
			menu: null,
			pendingWait: null,
			loadingCompleted: false,
			maxHeight: 'none',
			now: moment(),
		}
	},
	computed: {
		...mapGetters({
			searchQuery: 'searchQuery',
			filter: 'filter',
			sortOrder: 'sortOrder',
			sortDirection: 'sortDirection',
		}),
		view() {
			return this.$store.getters.tbView(this.viewKey)
		},
		allColumns() {
			return normalizeColumns(this.$store.getters.tbPrefs.tableColumns)
		},
		columns() {
			return shownColumns(this.allColumns, !this.collectionId)
		},
		completedLoaded() {
			return this.calendars.every(calendar => calendar.loadedCompleted)
		},
		rows() {
			let tasks = collectBoardTasks({
				calendars: this.calendars,
				collectionId: this.collectionId,
				cards: this.view.cards,
				searchQuery: this.searchQuery,
				filter: this.filter,
			})
			if (!this.view.tableShowClosed) {
				tasks = tasks.filter(task => !task.closed)
			}
			return tbSort(tasks, this.sortOrder, this.sortDirection)
		},
		people() {
			return this.menu?.type === 'assignee' ? this.$store.getters.tbAssigneesFor(this.menu.task.calendar.id) : []
		},
		peopleLoading() {
			const id = this.menu?.task?.calendar?.id
			return !!id && !!this.$store.state.tbAssignment.assignees[id]?.loading
		},
		menuTitle() {
			return {
				status: tbt('Status'),
				priority: tbt('Priority'),
				assignee: tbt('Assigned to'),
				due: tbt('Due'),
			}[this.menu?.type] || ''
		},
		menuItems() {
			const task = this.menu?.task
			if (!task) {
				return []
			}
			switch (this.menu.type) {
			case 'status': {
				const current = boardColumn(task, this.now)
				return Object.entries(STATUS).map(([value, status]) => ({
					value,
					label: tbt(status.label) + (value === 'waiting' ? ' …' : ''),
					icon: status.icon,
					checked: value === current,
				}))
			}
			case 'priority': {
				const current = priorityGroup(task)
				return Object.entries(PRIORITY).map(([group, priority]) => ({
					value: priority.value,
					label: tbt(priority.label) + (priority.value ? ' (' + priority.value + ')' : ''),
					color: PRIORITY_COLORS[group],
					checked: group === current,
				}))
			}
			case 'assignee': {
				const current = assigneeOf(task)?.uid || null
				const items = this.people.map(person => ({ value: person.uid, label: person.displayName, person, checked: person.uid === current }))
				items.push({ value: '', label: tbt('Remove assignment'), icon: AccountOffOutline, checked: false })
				return items
			}
			case 'due':
				return [
					{ value: 0, label: tbt('Today'), icon: CalendarToday },
					{ value: 1, label: tbt('Tomorrow'), icon: CalendarToday },
					{ value: 7, label: tbt('In one week'), icon: CalendarToday },
					{ value: null, label: tbt('No due date'), icon: CalendarRemoveOutline },
				]
			}
			return []
		},
	},
	watch: {
		columns() {
			this.$nextTick(this.setupSortable)
		},
	},
	mounted() {
		this.setupSortable()
		this.updateHeight()
		window.addEventListener('resize', this.updateHeight)
		this.timer = setInterval(() => { this.now = moment() }, 60000)
	},
	beforeUnmount() {
		window.removeEventListener('resize', this.updateHeight)
		clearInterval(this.timer)
		this.sortable?.destroy()
	},
	updated() {
		this.updateHeight()
	},
	methods: {
		tbt,
		stateOf(task) {
			return boardColumn(task, this.now)
		},
		statusLabel(task) {
			return tbt(STATUS[this.stateOf(task)].label)
		},
		statusIcon(task) {
			return STATUS[this.stateOf(task)].icon
		},
		priorityOf(task) {
			return priorityGroup(task)
		},
		priorityLabel(task) {
			return tbt(PRIORITY[priorityGroup(task)].label)
		},
		priorityClass(task) {
			return { high: 'priority--high', medium: 'priority--medium', low: 'priority--low' }[priorityGroup(task)] || ''
		},
		assignee(task) {
			return assigneeOf(task)
		},
		parent(task) {
			return parentTask(task)
		},
		isReadOnly(task) {
			return isTaskReadOnly(task)
		},
		isWaiting(task) {
			return this.stateOf(task) === 'waiting'
		},
		isOverdue(task) {
			return !task.closed && task.dueMoment.isValid() && task.dueMoment.isBefore(this.now, 'day')
		},
		isFollowUp(task) {
			return isFollowUpDue(task, this.now)
		},
		visibleTags(task) {
			return [...task.tags].sort((a, b) => a.localeCompare(b)).slice(0, 3)
		},
		subtaskCount(task) {
			const subTasks = Object.values(task.subTasks || {}).filter(sub => sub.status !== 'CANCELLED')
			return { done: subTasks.filter(sub => sub.completed).length, total: subTasks.length }
		},
		formatDate(value) {
			return value && value.isValid() ? value.format('DD.MM.YY') : ''
		},
		isoDate(value) {
			return value && value.isValid() ? value.format('YYYY-MM-DD') : ''
		},
		isSorted(column) {
			return !!column.sort && column.sort === this.sortOrder
		},
		ariaSort(column) {
			if (!this.isSorted(column)) {
				return 'none'
			}
			return this.sortDirection ? 'descending' : 'ascending'
		},
		sortBy(column) {
			const direction = this.sortOrder === column.sort ? !this.sortDirection : false
			this.$store.dispatch('setTbView', { key: this.viewKey, patch: { sortOrder: column.sort, sortDirection: direction } })
		},
		updateHeight() {
			const scroller = this.$refs.scroller
			if (!scroller) {
				return
			}
			const top = scroller.getBoundingClientRect().top
			const height = Math.max(240, window.innerHeight - Math.max(top, 0) - 16)
			const value = height + 'px'
			if (value !== this.maxHeight) {
				this.maxHeight = value
			}
		},
		/** Columns can be moved by dragging the header (not the task name) */
		setupSortable() {
			this.sortable?.destroy()
			const row = this.$refs.headRow
			if (!row) {
				return
			}
			this.sortable = SortableJS.create(row, {
				animation: 150,
				filter: '.tb-table__th--fixed',
				preventOnFilter: false,
				onMove: (event) => !event.related.classList.contains('tb-table__th--fixed'),
				onEnd: (event) => {
					const { item, from, oldIndex, newIndex } = event
					// Put the header back, Vue renders the new order
					from.removeChild(item)
					from.insertBefore(item, from.children[oldIndex] || null)
					if (oldIndex === newIndex) {
						return
					}
					const keys = this.columns.map(column => column.key)
					const fromIndex = this.allColumns.findIndex(column => column.key === keys[oldIndex])
					const toIndex = this.allColumns.findIndex(column => column.key === keys[newIndex])
					const moved = moveColumn(this.allColumns, fromIndex, toIndex)
					this.$store.dispatch('setTbPrefs', { tableColumns: storableColumns(moved) })
				},
			})
		},
		onRowClick(task, $event) {
			if (handleSelectClick(this.$store, task, $event)) {
				return
			}
			if ($event.target.closest('button, input, a, .no-nav')) {
				return
			}
			this.openTask(task)
		},
		async openTask(task) {
			if (this.$route.params.taskId === task.uri) {
				return
			}
			if (!task.loadedCompleted) {
				this.$store.dispatch('getTasksFromCalendar', { calendar: task.calendar, completed: true, related: task.uid })
			}
			if (this.$route.params.calendarId) {
				await this.$router.push({ name: 'calendarsTask', params: { calendarId: this.$route.params.calendarId, taskId: task.uri } })
			} else {
				await this.$router.push({ name: 'collectionsTask', params: { collectionId: this.collectionId, taskId: task.uri } })
			}
		},
		toggleCompleted(task) {
			this.$store.dispatch('toggleCompleted', task)
		},
		openMenu(type, task, $event) {
			if (isTaskReadOnly(task)) {
				return
			}
			const anchor = $event.currentTarget
			if (this.menu && this.menu.anchor === anchor) {
				this.menu = null
				return
			}
			this.menu = { type, task, anchor }
			if (type === 'assignee') {
				this.$store.dispatch('loadTbAssignees', { calendar: task.calendar })
			}
		},
		async onMenuSelect(value) {
			const { type, task } = this.menu
			// Read the persons before the menu closes (they depend on it)
			const people = this.people
			this.menu = null
			try {
				switch (type) {
				case 'status':
					if (value === 'waiting') {
						this.pendingWait = task
						return
					}
					await this.$store.dispatch('moveTaskToBoardColumn', { task, column: value })
					break
				case 'priority':
					await this.$store.dispatch('setPriority', { task, priority: value })
					break
				case 'assignee': {
					const person = value ? people.find(entry => entry.uid === value) || null : null
					await this.$store.dispatch('setTbAssignee', { task, person })
					break
				}
				case 'due':
					await this.$store.dispatch('setDue', {
						task,
						due: value === null ? null : moment().add(value, 'days').startOf('day'),
						allDay: true,
					})
					break
				}
			} catch (error) {
				console.error(error)
				showError(tbt('Could not change the task.'))
			}
		},
		pickDate(value) {
			const task = this.menu?.task
			this.menu = null
			if (!task || !value) {
				return
			}
			this.$store.dispatch('setDue', { task, due: moment(value, 'YYYY-MM-DD').startOf('day'), allDay: true })
		},
		async confirmWait(date) {
			const task = this.pendingWait
			this.pendingWait = null
			try {
				await this.$store.dispatch('moveTaskToBoardColumn', { task, column: 'waiting', waitUntil: date })
			} catch (error) {
				console.error(error)
				showError(tbt('Could not change the task.'))
			}
		},
		async loadCompleted() {
			this.loadingCompleted = true
			try {
				await Promise.all(this.calendars
					.filter(calendar => !calendar.loadedCompleted)
					.map(calendar => this.$store.dispatch('getTasksFromCalendar', { calendar, completed: true, related: null })))
			} finally {
				this.loadingCompleted = false
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-table-view {
	padding: calc(2 * var(--default-grid-baseline)) calc(3 * var(--default-grid-baseline)) calc(3 * var(--default-grid-baseline));
}

.tb-table {
	overflow: auto;
	border: 1px solid var(--color-border);
	border-radius: 12px;
	background-color: var(--tb-card-bg, var(--color-main-background));

	&__table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-size: 14px;
	}

	&__th {
		position: sticky;
		top: 0;
		z-index: 2;
		height: 40px;
		padding: 0 6px;
		border-bottom: 1px solid var(--color-border);
		background-color: var(--tb-card-bg, var(--color-main-background));
		color: var(--color-text-maxcontrast);
		font-size: 13px;
		font-weight: 600;
		text-align: start;
		white-space: nowrap;
		cursor: grab;
		user-select: none;

		&--fixed {
			left: 0;
			z-index: 3;
			cursor: default;
		}

		&--sorted {
			color: var(--color-main-text);
		}

		&.sortable-ghost {
			opacity: .4;
		}
	}

	&__sort {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		min-height: 32px;
		margin: 0;
		padding: 0 6px;
		border: none;
		border-radius: var(--border-radius, 8px);
		background: transparent;
		color: inherit;
		font: inherit;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			background-color: var(--color-background-hover);
		}

		&--plain {
			cursor: inherit;

			&:hover {
				background: transparent;
			}
		}
	}

	&__row {
		cursor: pointer;

		td {
			border-bottom: 1px solid var(--color-border);
		}

		&:last-child td {
			border-bottom: none;
		}

		&:hover td {
			background-color: var(--color-background-hover);
		}

		&--active td,
		&--active:hover td {
			background-color: color-mix(in srgb, var(--color-primary-element) 10%, var(--tb-card-bg, var(--color-main-background)));
		}

		&--selected td,
		&--selected:hover td {
			background-color: var(--tb-selected, color-mix(in srgb, var(--color-primary-element) 13%, var(--color-main-background)));
		}

		// Keyboard focus (J/K): tint and a bar at the start (an outline would hide behind the sticky first cell)
		&:focus-visible {
			outline: none;

			td {
				background-color: color-mix(in srgb, var(--color-primary-element) 8%, var(--tb-card-bg, var(--color-main-background)));
			}

			td:first-child {
				box-shadow: inset 3px 0 0 var(--color-primary-element);
			}
		}

		&--closed .tb-table__title {
			color: var(--color-text-maxcontrast);
			text-decoration: line-through;
		}
	}

	&__td {
		height: 40px;
		padding: 0 6px;
		background-color: var(--tb-card-bg, var(--color-main-background));
		white-space: nowrap;
		vertical-align: middle;

		&--summary {
			position: sticky;
			left: 0;
			z-index: 1;
			min-width: 240px;
			max-width: 440px;

			@media only screen and (max-width: 600px) {
				min-width: 160px;
				max-width: 200px;
			}
		}

		&--tags {
			max-width: 260px;
		}

		&--calendar,
		&--parent {
			max-width: 220px;
		}
	}

	&__summary {
		display: flex;
		align-items: center;
		gap: 4px;
		min-width: 0;
	}

	&__check {
		flex: 0 0 auto;
	}

	&__title {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		font-weight: 500;
	}

	&__cell-button {
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		min-height: 32px;
		margin: 0;
		padding: 0 8px;
		border: 1px solid transparent;
		border-radius: var(--border-radius, 8px);
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: normal;
		text-align: start;
		cursor: pointer;

		&:hover:not(:disabled),
		&:focus-visible {
			border-color: var(--color-border-dark);
			background-color: var(--tb-card-bg, var(--color-main-background));
		}

		&:disabled {
			cursor: default;
			opacity: 1;
		}
	}

	&__empty,
	&__muted {
		color: var(--color-text-maxcontrast);
	}

	&__ellipsis {
		display: block;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	&__date {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		padding: 1px 6px;
		border: 1px solid transparent;
		border-radius: 6px;
		font-variant-numeric: tabular-nums;

		&--waiting {
			color: var(--tb-status-waiting);
		}

		&--overdue {
			border-color: var(--tb-prio-high);
			color: var(--tb-prio-high);
		}
	}

	&__list {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	&__dot {
		flex: 0 0 auto;
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background-color: currentColor;
	}

	&__status {
		display: inline-flex;
		align-items: center;
		gap: 6px;

		:deep(.material-design-icon) {
			color: var(--tb-status-open);
		}

		&--inProgress :deep(.material-design-icon) {
			color: var(--tb-status-progress);
		}

		&--waiting :deep(.material-design-icon) {
			color: var(--tb-status-waiting);
		}

		&--done :deep(.material-design-icon) {
			color: var(--tb-status-done);
		}

		&--cancelled :deep(.material-design-icon) {
			color: var(--tb-status-cancelled);
		}
	}

	&__priority {
		display: inline-flex;
		align-items: center;
		gap: 6px;

		.tb-table__dot {
			color: var(--color-text-maxcontrast);
		}

		&--high .tb-table__dot {
			color: var(--tb-prio-high);
		}

		&--medium .tb-table__dot {
			color: var(--tb-prio-medium);
		}

		&--low .tb-table__dot {
			color: var(--tb-prio-low);
		}

		&--none {
			color: var(--color-text-maxcontrast);
		}
	}

	&__tags {
		display: flex;
		align-items: center;
		gap: 4px;
		overflow: hidden;
	}

	&__progress {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	&__bar {
		display: inline-block;
		width: 60px;
		height: 6px;
		overflow: hidden;
		border-radius: 3px;
		background-color: var(--color-background-dark);

		span {
			display: block;
			height: 100%;
			background-color: var(--tb-status-progress);
		}
	}

	&__overview {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: var(--color-text-maxcontrast);
	}

	&__subcount {
		display: inline-flex;
		align-items: center;
		gap: 3px;
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	&__empty-state {
		padding: 24px;
		color: var(--color-text-maxcontrast);
		text-align: center;
	}

	&__load {
		margin-top: 8px;
	}

	&__date-pick {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 4px 0 0;
		padding: 6px 8px 4px;
		border-top: 1px solid var(--color-border);
		color: var(--color-text-maxcontrast);
		font-size: 12px;

		input {
			width: 100%;
			margin: 0;
		}
	}
}
</style>
