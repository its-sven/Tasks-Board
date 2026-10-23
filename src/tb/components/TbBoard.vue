<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div class="tb-board">
		<div v-for="lane in board"
			:key="lane.key"
			class="tb-board__lane">
			<h2 v-if="lane.type !== 'all'" class="tb-board__lane-title">
				<TbAvatar v-if="lane.type === 'assignee'" :person="lane.assignee" :size="24" />
				<span v-else-if="lane.color" class="tb-board__bullet" :style="{ 'background-color': lane.color }" />
				<span class="tb-board__lane-name">{{ laneTitle(lane) }}</span>
				<span class="tb-board__lane-count">{{ laneCount(lane) }}</span>
			</h2>
			<div class="tb-board__columns">
				<section v-for="column in columns"
					:key="column"
					class="tb-board__column"
					:class="'tb-board__column--' + column">
					<header class="tb-board__column-header">
						<span class="tb-board__dot" />
						<span class="tb-board__column-title">{{ columnTitle(column) }}</span>
						<span v-if="column !== 'done' || showClosed" class="tb-board__count">{{ lane.columns[column].length }}</span>
						<NcButton v-if="canAdd(lane, column)"
							class="tb-board__add-button"
							variant="tertiary"
							size="small"
							:aria-label="tbt('Add task to {column}', { column: columnTitle(column) })"
							:title="tbt('Add task to {column}', { column: columnTitle(column) })"
							@click="startAdd(lane, column)">
							<template #icon>
								<Plus :size="18" />
							</template>
						</NcButton>
					</header>
					<form v-if="isAdding(lane, column)"
						class="tb-board__add"
						@submit.prevent="addTask(lane, column)">
						<input ref="addInput"
							v-model="newSummary"
							class="tb-board__add-input"
							type="text"
							:placeholder="tbt('New task…')"
							:aria-label="tbt('New task…')"
							:disabled="addingBusy"
							@keydown.esc.prevent="cancelAdd"
							@blur="onAddBlur">
					</form>
					<template v-if="column === 'done'">
						<!-- Hidden completed tasks: the column stays, so tasks can still be dropped here -->
						<p v-if="!showClosed" class="tb-board__hint tb-board__hint--hidden">
							<span>{{ tbt('Completed tasks are hidden.') }}</span>
							<button type="button" class="tb-board__show-closed" @click="showClosedTasks">
								{{ tbt('Show') }}
							</button>
						</p>
						<p v-else-if="collectionId" class="tb-board__hint">
							{{ tbt('Completed tasks of the last {days} days', { days: recentDays }) }}
						</p>
					</template>
					<Sortable tag="ol"
						class="tb-board__cards"
						:class="{ 'tb-board__cards--empty': !lane.columns[column].length }"
						:list="visibleCards(lane, column)"
						item-key="key"
						:data-column="column"
						:data-lane="lane.key"
						:data-empty-text="tbt('Drop tasks here')"
						:options="sortableOptions(lane, column)"
						@choose="onChoose"
						@add="onAdd"
						@update="onUpdate">
						<template #item="{ element }">
							<TbBoardCard :task="element"
								:show-calendar="showCalendar"
								:show-parent="view.cards === 'all' || !!collectionId"
								:active="element.uri === $route.params.taskId"
								:show-assignee="lanes !== 'assignee'"
								@open="openTask"
								@toggle-completed="toggleCompleted" />
						</template>
					</Sortable>
					<NcButton v-if="isLimited(column) && lane.columns[column].length > closedLimit"
						variant="tertiary"
						size="small"
						wide
						@click="toggleExpanded(lane, column)">
						{{ isExpanded(lane, column) ? tbt('Show less') : tbt('Show {count} more', { count: lane.columns[column].length - closedLimit }) }}
					</NcButton>
				</section>
			</div>
		</div>

		<TbWaitDialog v-if="pendingWait"
			:task="pendingWait.task"
			@confirm="confirmWait"
			@cancel="pendingWait = null" />
	</div>
</template>

<script>
import {
	CLOSED_LIMIT,
	COLUMNS,
	RECENTLY_CLOSED_DAYS,
	ADD_COLUMNS,
	MANUAL_COLUMNS,
	buildBoard,
	collectBoardTasks,
	effectiveLanes,
	laneTaskDefaults,
	manualOrderChanges,
} from '../board.js'
import { tbt } from '../l10n.js'
import { sort as tbSort } from '../sort.js'
import { isTaskReadOnly } from '../store/board.js'
import { currentPerson, currentUid, requestNotification } from '../store/assignment.js'
import TbAvatar from './TbAvatar.vue'
import TbBoardCard from './TbBoardCard.vue'
import TbWaitDialog from './TbWaitDialog.vue'

import { showError } from '@nextcloud/dialogs'
import moment from '@nextcloud/moment'
import NcButton from '@nextcloud/vue/components/NcButton'

import Plus from 'vue-material-design-icons/Plus.vue'

import { Sortable } from 'sortablejs-vue3'
import { mapGetters } from 'vuex'

const LIMITED_COLUMNS = ['done', 'cancelled']

export default {
	name: 'TbBoard',
	components: {
		NcButton,
		TbAvatar,
		TbBoardCard,
		TbWaitDialog,
		Plus,
		Sortable,
	},
	props: {
		/** Calendars to show */
		calendars: {
			type: Array,
			required: true,
		},
		/** Collection id or null for a single list */
		collectionId: {
			type: String,
			default: null,
		},
		/** Key of the stored view settings */
		viewKey: {
			type: String,
			required: true,
		},
	},
	data() {
		return {
			pendingWait: null,
			adding: null,
			addingBusy: false,
			newSummary: '',
			expanded: {},
			closedLimit: CLOSED_LIMIT,
			recentDays: RECENTLY_CLOSED_DAYS,
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
		lanes() {
			return effectiveLanes(this.view)
		},
		showClosed() {
			return this.$store.getters.tbShowClosed
		},
		/**
		 * The column "Cancelled" only with the completed tasks shown and when it has cards
		 *
		 * @return {string[]}
		 */
		columns() {
			const cancelled = this.showClosed && this.tasks.some(task => task.status === 'CANCELLED')
			return COLUMNS.filter(column => column !== 'cancelled' || cancelled)
		},
		showCalendar() {
			return !!this.collectionId && this.lanes !== 'calendar'
		},
		tasks() {
			const tasks = collectBoardTasks({
				calendars: this.calendars,
				collectionId: this.collectionId,
				cards: this.view.cards,
				searchQuery: this.searchQuery,
				filter: this.filter,
			})
			return this.showClosed ? tasks : tasks.filter(task => !task.closed)
		},
		board() {
			return buildBoard(this.tasks, {
				lanes: this.lanes,
				showCancelled: this.showClosed,
				calendars: this.calendars,
				// The cards can also be put in order by hand
				sortOrder: this.manualOrder ? 'manual' : this.sortOrder,
				sortDirection: this.manualOrder ? false : this.sortDirection,
				sortFn: tbSort,
			})
		},
		manualOrder() {
			return this.view.boardOrder === 'manual'
		},
	},
	methods: {
		tbt,
		laneCount(lane) {
			return Object.values(lane.columns).reduce((sum, tasks) => sum + tasks.length, 0)
		},
		/**
		 * The list a task added in this row goes to
		 *
		 * @param {object} lane The row
		 * @return {object|null} The calendar or null
		 */
		targetCalendar(lane) {
			const { calendarId } = laneTaskDefaults(lane)
			if (calendarId) {
				return this.calendars.find(calendar => calendar.id === calendarId) || null
			}
			if (this.calendars.length === 1) {
				return this.calendars[0]
			}
			return this.$store.getters.getCalendarByRoute(this.$route) || null
		},
		canAdd(lane, column) {
			const calendar = this.targetCalendar(lane)
			return ADD_COLUMNS.includes(column) && !!calendar && !calendar.readOnly
		},
		addKey(lane, column) {
			return lane.key + '/' + column
		},
		isAdding(lane, column) {
			return this.adding === this.addKey(lane, column)
		},
		async startAdd(lane, column) {
			this.adding = this.addKey(lane, column)
			this.newSummary = ''
			await this.$nextTick()
			const input = Array.isArray(this.$refs.addInput) ? this.$refs.addInput[0] : this.$refs.addInput
			input?.focus()
		},
		cancelAdd() {
			this.adding = null
			this.newSummary = ''
		},
		onAddBlur() {
			if (!this.newSummary.trim() && !this.addingBusy) {
				this.cancelAdd()
			}
		},
		/**
		 * Properties for new tasks in a collection (as the header input does)
		 *
		 * @return {object}
		 */
		collectionTaskProperties() {
			const properties = {}
			switch (this.collectionId) {
			case 'starred':
				properties.priority = 1
				break
			case 'today':
				properties.due = moment().startOf('day').format('YYYY-MM-DDTHH:mm:ss')
				properties.allDay = this.$store.state.settings.settings.allDay
				break
			case 'current':
				properties.start = moment().format('YYYY-MM-DDTHH:mm:ss')
				break
			case 'assigned':
				properties.tbAssignee = currentPerson(this.$store.getters)
				break
			}
			return properties
		},
		async addTask(lane, column) {
			const summary = this.newSummary.trim()
			if (!summary || this.addingBusy) {
				return
			}
			const calendar = this.targetCalendar(lane)
			const { priority, related, assignee } = laneTaskDefaults(lane)
			this.addingBusy = true
			try {
				const created = await this.$store.dispatch('createTask', {
					summary,
					calendar,
					...this.collectionTaskProperties(),
					...(priority && { priority }),
					...(related && { related }),
					...(assignee && { tbAssignee: { ...assignee, assignedBy: currentUid() } }),
				})
				if (created && assignee && assignee.uid !== currentUid()) {
					requestNotification('assigned', created)
				}
				// createTask returns the plain object, changes must go through the store's (reactive) copy
				const task = created && (this.$store.getters.getTaskByUid(created.uid) || created)
				this.newSummary = ''
				if (task && column === 'inProgress') {
					await this.move(task, 'inProgress')
				} else if (task && column === 'waiting') {
					this.pendingWait = { task }
				}
			} catch (error) {
				console.error(error)
				showError(tbt('Could not create the task.'))
			} finally {
				this.addingBusy = false
			}
			await this.$nextTick()
			const input = Array.isArray(this.$refs.addInput) ? this.$refs.addInput[0] : this.$refs.addInput
			if (column !== 'waiting') {
				input?.focus()
			}
		},
		columnTitle(column) {
			return {
				open: tbt('Open'),
				inProgress: tbt('In progress'),
				waiting: tbt('Waiting'),
				done: tbt('Done'),
				cancelled: tbt('Cancelled'),
			}[column]
		},
		laneTitle(lane) {
			switch (lane.type) {
			case 'priority':
				return {
					high: tbt('Important (1–4)'),
					medium: tbt('Normal (5)'),
					low: tbt('Someday (6–9)'),
					none: tbt('No priority'),
				}[lane.group]
			case 'parentNone':
				return tbt('Without main task')
			case 'assigneeNone':
				return tbt('Not assigned')
			default:
				return lane.title
			}
		},
		sortableOptions(lane, column) {
			return {
				group: 'tb-board-' + lane.key,
				sort: this.manualOrder && MANUAL_COLUMNS.includes(column),
				animation: 150,
				delay: 300,
				delayOnTouchOnly: true,
				touchStartThreshold: 3,
				filter: '.tb-card--readonly',
				preventOnFilter: false,
				emptyInsertThreshold: 40,
			}
		},
		isLimited(column) {
			return LIMITED_COLUMNS.includes(column)
		},
		isExpanded(lane, column) {
			return !!this.expanded[lane.key + '/' + column]
		},
		toggleExpanded(lane, column) {
			const key = lane.key + '/' + column
			this.expanded = { ...this.expanded, [key]: !this.expanded[key] }
		},
		visibleCards(lane, column) {
			const cards = lane.columns[column]
			if (this.isLimited(column) && !this.isExpanded(lane, column)) {
				return cards.slice(0, this.closedLimit)
			}
			return cards
		},

		/**
		 * Remembers where the dragged card was, so the DOM can be restored exactly.
		 * Each card is rendered inside a Vue fragment (with anchor text nodes),
		 * so restoring by element index would break Vue's bookkeeping.
		 *
		 * @param {object} $event The SortableJS event
		 */
		onChoose($event) {
			this.dragOrigin = { item: $event.item, parent: $event.item.parentNode, next: $event.item.nextSibling }
		},

		/**
		 * A card was dropped into another column.
		 * The DOM change of SortableJS is reverted, the store change re-renders the board.
		 *
		 * @param {object} $event The SortableJS event
		 */
		onAdd($event) {
			const { item } = $event
			this.restoreDrag(item)
			// Look up by key (uid + list): URIs are only unique within one list
			const task = this.tasks.find(task => task.key === item.dataset.taskKey)
			const column = $event.to.dataset.column
			if (!task || !column || isTaskReadOnly(task)) {
				return
			}
			// With the manual order the card stays where it was dropped
			const position = this.manualOrder && MANUAL_COLUMNS.includes(column)
				? { cards: this.columnCards($event.to.dataset.lane, column), index: $event.newIndex }
				: null
			if (column === 'waiting') {
				this.pendingWait = { task, position }
				return
			}
			this.move(task, column, null, position)
		},
		/**
		 * A card was moved within its column (manual order only)
		 *
		 * @param {object} $event The SortableJS event
		 */
		onUpdate($event) {
			const { item } = $event
			this.restoreDrag(item)
			const task = this.tasks.find(task => task.key === item.dataset.taskKey)
			const column = $event.to.dataset.column
			if (!task || !this.manualOrder || isTaskReadOnly(task) || $event.oldIndex === $event.newIndex) {
				return
			}
			this.applyOrder(this.columnCards($event.to.dataset.lane, column), task, $event.newIndex)
		},
		/**
		 * Puts the card SortableJS moved back to where Vue rendered it, the store change re-renders the board
		 *
		 * @param {Element} item The dragged card
		 */
		restoreDrag(item) {
			const origin = this.dragOrigin
			this.dragOrigin = null
			if (origin && origin.item === item && origin.parent) {
				origin.parent.insertBefore(item, origin.next && origin.next.parentNode === origin.parent ? origin.next : null)
			} else {
				item.parentNode?.removeChild(item)
			}
		},
		columnCards(laneKey, column) {
			const lane = this.board.find(lane => lane.key === laneKey)
			return lane ? this.visibleCards(lane, column) : []
		},
		applyOrder(cards, task, index) {
			for (const change of manualOrderChanges(cards, task, index)) {
				if (!isTaskReadOnly(change.task)) {
					this.$store.dispatch('setSortOrder', change)
				}
			}
		},
		confirmWait(date) {
			const { task, position } = this.pendingWait
			this.pendingWait = null
			this.move(task, 'waiting', date, position)
		},
		async move(task, column, waitUntil = null, position = null) {
			try {
				await this.$store.dispatch('moveTaskToBoardColumn', { task, column, waitUntil })
				if (position) {
					this.applyOrder(position.cards, task, position.index)
				}
			} catch (error) {
				console.error(error)
				showError(tbt('Could not move the task.'))
			}
		},
		showClosedTasks() {
			this.$store.dispatch('setTbShowClosed', true)
		},
		toggleCompleted(task) {
			this.$store.dispatch('toggleCompleted', task)
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
	},
}
</script>

<style lang="scss" scoped>
.tb-board {
	padding: calc(3 * var(--default-grid-baseline)) calc(3 * var(--default-grid-baseline)) calc(4 * var(--default-grid-baseline));

	&__hint {
		color: var(--color-text-maxcontrast);
		font-size: 12px;
		margin: 0 4px 6px;
	}

	&__hint--hidden {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 4px;
	}

	&__show-closed {
		min-height: 0;
		margin: 0;
		padding: 0;
		border: none;
		background: none;
		color: var(--color-primary-element);
		font-size: inherit;
		font-weight: 600;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			text-decoration: underline;
		}
	}

	&__lane {
		margin-bottom: calc(5 * var(--default-grid-baseline));
	}

	&__lane-title {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		font-weight: 600;
		margin: 0 4px 8px;
		padding-bottom: 6px;
		border-bottom: 1px solid var(--color-border);
	}

	&__lane-count {
		color: var(--color-text-maxcontrast);
		font-weight: normal;
		font-size: 12px;
	}

	&__bullet {
		display: inline-block;
		flex-shrink: 0;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	&__columns {
		display: flex;
		gap: 12px;
		overflow-x: auto;
		align-items: flex-start;
		padding-bottom: 8px;
	}

	&__column {
		--tb-column-color: var(--tb-status-open, #8a94a6);
		flex: 1 0 250px;
		max-width: 400px;
		min-width: 0;
		background-color: var(--tb-column-bg, var(--color-background-hover));
		border-radius: 12px;
		padding: 6px 6px 8px;
		display: flex;
		flex-direction: column;

		&--inProgress {
			--tb-column-color: var(--tb-status-progress, #3d7bd9);
		}

		&--waiting {
			--tb-column-color: var(--tb-status-waiting, #e09b13);
		}

		&--done {
			--tb-column-color: var(--tb-status-done, #2e9e5b);
		}

		// Rarely used: narrower, so five columns fit more often
		&--cancelled {
			--tb-column-color: var(--tb-status-cancelled, #9aa0a6);
			flex-basis: 200px;
			max-width: 320px;
		}
	}

	&__column-header {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
		padding: 0 4px 0 8px;
		margin-bottom: 4px;
	}

	&__dot {
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background-color: var(--tb-column-color);
	}

	&__column-title {
		font-size: 13px;
		font-weight: 600;
	}

	&__count {
		font-size: 12px;
		color: var(--color-text-maxcontrast);
		min-width: 20px;
		padding: 0 6px;
		line-height: 18px;
		text-align: center;
		border-radius: var(--border-radius-pill, 18px);
		background-color: var(--color-background-dark);
	}

	&__add-button {
		margin-left: auto;
		opacity: .7;

		&:hover,
		&:focus-visible {
			opacity: 1;
		}
	}

	&__add {
		margin: 0 0 6px;
	}

	&__add-input {
		width: 100%;
		height: 36px;
		min-height: 0;
		margin: 0;
		padding: 0 10px;
		font-size: 14px;
		border: 1px solid var(--color-primary-element);
		border-radius: var(--tb-radius, 10px);
		background-color: var(--color-main-background);
		box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-element) 18%, transparent);
	}

	&__cards {
		display: flex;
		flex-direction: column;
		gap: 6px;
		min-height: 44px;
		margin: 0;
		padding: 0;
		flex-grow: 1;
		position: relative;

		&--empty::after {
			content: attr(data-empty-text);
			display: flex;
			align-items: center;
			justify-content: center;
			position: absolute;
			inset: 0;
			color: var(--color-text-maxcontrast);
			font-size: 12px;
			border: 1px dashed var(--color-border-dark);
			border-radius: var(--tb-radius, 10px);
			pointer-events: none;
		}
	}

	// Phones: one column per screen width, swipe between columns
	@media only screen and (max-width: 600px) {
		padding-inline: 8px;

		&__columns {
			scroll-snap-type: x mandatory;
		}

		&__column {
			flex: 0 0 85%;
			scroll-snap-align: start;
		}
	}
}
</style>
