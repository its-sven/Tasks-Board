<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<li class="tb-card"
		:class="{
			'tb-card--active': active,
			'tb-card--closed': task.closed,
			'tb-card--readonly': readOnly,
			'tb-card--selected': $store.getters.isTbSelected(task.key),
			['tb-card--' + priorityGroup]: true,
		}"
		:data-task-uri="task.uri"
		:data-task-key="task.key"
		:title="readOnly ? tbt('Read-only') : null"
		tabindex="0"
		@click="open"
		@keydown.enter.self="open">
		<div class="tb-card__head">
			<TaskCheckbox class="tb-card__checkbox"
				:completed="task.completed"
				:cancelled="task.status === 'CANCELLED'"
				:read-only="readOnly"
				:priority-class="priorityClass"
				@click.stop
				@toggle-completed="$emit('toggleCompleted', task)" />
			<span class="tb-card__summary">{{ task.summary }}</span>
			<span v-if="task.priority > 0"
				class="tb-chip tb-chip--priority"
				:class="'tb-chip--' + priorityGroup"
				:title="tbt('Priority {priority}', { priority: task.priority })">P{{ task.priority }}</span>
			<TbAvatar v-if="showAssignee"
				class="tb-card__assignee"
				:person="task._tbAssignee"
				:size="22" />
		</div>

		<div v-if="parent || showCalendar" class="tb-card__context">
			<span v-if="showCalendar" class="tb-card__calendar">
				<span class="tb-card__bullet" :style="{ 'background-color': task.calendar.color }" />
				{{ task.calendar.displayName }}
			</span>
			<span v-if="parent" class="tb-card__parent" :title="parent.summary">
				<SubdirectoryArrowRight :size="14" />
				{{ parent.summary }}
			</span>
		</div>

		<div v-if="tags.length" class="tb-card__tags">
			<span v-for="tag in tags"
				:key="tag"
				class="tb-chip"
				:class="{ 'tb-chip--waiting': isWaitingTag(tag) }">{{ tag }}</span>
		</div>

		<p v-if="excerpt" class="tb-card__excerpt" :title="excerpt">
			{{ excerpt }}
		</p>

		<div v-if="hasMeta" class="tb-card__meta">
			<span v-if="followUp"
				class="tb-card__meta-item"
				:class="{ 'tb-card__meta-item--alert': followUp.alert }"
				:title="followUp.text">
				<CalendarClock :size="16" />
				{{ followUp.short }}
			</span>
			<span v-if="dueString"
				class="tb-card__meta-item"
				:class="{ 'tb-card__meta-item--alert': overdue }"
				:title="dueString">
				<CalendarEnd :size="16" />
				{{ dueShort }}
			</span>
			<button v-if="subtaskCount.total"
				type="button"
				class="tb-card__meta-item tb-card__subtoggle"
				:class="{ 'tb-card__subtoggle--open': expanded }"
				:aria-expanded="expanded ? 'true' : 'false'"
				:title="(expanded ? tbt('Hide subtasks') : tbt('Show subtasks')) + ' · ' + tbt('{done} of {total} subtasks done', subtaskCount)"
				@click.stop="toggleExpanded"
				@keydown.enter.stop>
				<ChevronRight :size="16" class="tb-card__chevron" />
				<FileTreeOutline :size="16" />
				{{ subtaskCount.done }}/{{ subtaskCount.total }}
			</button>
			<span v-if="showProgress"
				class="tb-card__meta-item"
				:title="tbt('{percent} % completed', { percent: task.complete })">
				<NcProgressBar type="circular"
					:value="task.complete"
					:size="16" />
				{{ task.complete }} %
			</span>
			<span v-if="checklist.total"
				class="tb-card__meta-item"
				:title="tbt('{done} of {total} checklist items done', checklist)">
				<FormatListChecks :size="16" />
				{{ checklist.done }}/{{ checklist.total }}
			</span>
		</div>

		<ul v-if="expanded && subtaskCount.total" class="tb-card__subtasks">
			<li v-for="subtask in subtasks"
				:key="subtask.key"
				class="tb-card__subtask"
				:class="{ 'tb-card__subtask--closed': subtask.closed, 'tb-card__subtask--active': subtask.uri === $route.params.taskId }"
				tabindex="0"
				@click.stop="$emit('open', subtask)"
				@keydown.enter.stop.self="$emit('open', subtask)">
				<TaskCheckbox class="tb-card__subcheckbox"
					:completed="subtask.completed"
					:cancelled="subtask.status === 'CANCELLED'"
					:read-only="isReadOnly(subtask)"
					:priority-class="priorityClassOf(subtask)"
					@click.stop
					@toggle-completed="$emit('toggleCompleted', subtask)" />
				<span class="tb-card__subsummary">{{ subtask.summary }}</span>
				<span v-if="subtaskCountOf(subtask)" class="tb-card__subcount" :title="tbt('{done} of {total} subtasks done', subtaskCountOf(subtask))">
					{{ subtaskCountOf(subtask).done }}/{{ subtaskCountOf(subtask).total }}
				</span>
				<TbAvatar v-if="showSubAssignee(subtask)" :person="subtask._tbAssignee" :size="18" />
			</li>
		</ul>
	</li>
</template>

<script>
import TaskCheckbox from '../../components/TaskCheckbox.vue'
import { followUpState, isWaitingTagName, parentTask, priorityGroup } from '../board.js'
import { shortDate } from '../dates.js'
import { tbt } from '../l10n.js'
import { countTaskItems, noteExcerpt } from '../markdown.js'
import { isTaskReadOnly } from '../store/board.js'
import TbAvatar from './TbAvatar.vue'
import { handleSelectClick } from '../store/selection.js'

import moment from '@nextcloud/moment'
import NcProgressBar from '@nextcloud/vue/components/NcProgressBar'

import { assigneeOf } from '../assignee.js'
import { sort as tbSort } from '../sort.js'

import CalendarClock from 'vue-material-design-icons/CalendarClock.vue'
import ChevronRight from 'vue-material-design-icons/ChevronRight.vue'
import CalendarEnd from 'vue-material-design-icons/CalendarEnd.vue'
import FileTreeOutline from 'vue-material-design-icons/FileTreeOutline.vue'
import FormatListChecks from 'vue-material-design-icons/FormatListChecks.vue'
import SubdirectoryArrowRight from 'vue-material-design-icons/SubdirectoryArrowRight.vue'

export default {
	name: 'TbBoardCard',
	components: {
		CalendarClock,
		CalendarEnd,
		ChevronRight,
		FileTreeOutline,
		FormatListChecks,
		NcProgressBar,
		TbAvatar,
		SubdirectoryArrowRight,
		TaskCheckbox,
	},
	props: {
		task: {
			type: Object,
			required: true,
		},
		showCalendar: {
			type: Boolean,
			default: false,
		},
		showParent: {
			type: Boolean,
			default: true,
		},
		active: {
			type: Boolean,
			default: false,
		},
		/** Hidden in rows by person, the row already says who */
		showAssignee: {
			type: Boolean,
			default: true,
		},
	},
	emits: ['open', 'toggleCompleted'],
	computed: {
		readOnly() {
			return isTaskReadOnly(this.task)
		},
		priorityGroup() {
			return priorityGroup(this.task)
		},
		priorityClass() {
			return {
				high: 'priority--high',
				medium: 'priority--medium',
				low: 'priority--low',
			}[this.priorityGroup] || ''
		},
		parent() {
			return this.showParent ? parentTask(this.task) : null
		},
		tags() {
			return [...this.task.tags].sort((a, b) => a.localeCompare(b))
		},
		subtaskCount() {
			const subTasks = Object.values(this.task.subTasks || {})
			return {
				done: subTasks.filter(task => task.closed).length,
				total: subTasks.length,
			}
		},
		followUp() {
			if (this.task.closed) {
				return null
			}
			const state = followUpState(this.task)
			const date = shortDate(this.task.startMoment)
			switch (state) {
			case 'pending':
				return { short: tbt('Follow-up {date}', { date }), text: tbt('Follow-up {date}', { date }), alert: false }
			case 'reached':
				return { short: date, text: tbt('Follow-up reached {date}', { date }), alert: true }
			case 'noDate':
				return { short: '?', text: tbt('Follow-up without date'), alert: true }
			default:
				return null
			}
		},
		overdue() {
			return !this.task.closed && this.task.dueMoment.isValid() && this.task.dueMoment.isBefore(moment(), this.task.allDay ? 'day' : undefined)
		},
		dueShort() {
			return shortDate(this.task.dueMoment)
		},
		dueString() {
			return this.task.dueMoment.isValid() ? tbt('Due {date}', { date: this.task.dueMoment.format('L') }) : ''
		},
		/** 1 % is what the app sets for "in progress" without real progress */
		showProgress() {
			return this.task.complete > 1 && !this.task.completed
		},
		excerpt() {
			return noteExcerpt(this.task.note, 140)
		},
		checklist() {
			return countTaskItems(this.task.note)
		},
		expanded() {
			return !!this.$store.state.tbBoard.expandedCards[this.task.key]
		},
		/** Subtasks in the order chosen for subtasks (open ones first) */
		subtasks() {
			const getters = this.$store.getters
			const order = getters.tbSubtaskOrder !== 'inherit' ? getters.tbSubtaskOrder : getters.sortOrder
			const sorted = tbSort(Object.values(this.task.subTasks || {}), order, getters.tbSubtaskOrder !== 'inherit' ? false : getters.sortDirection)
			return [...sorted.filter(task => !task.closed), ...sorted.filter(task => task.closed)]
		},
		hasMeta() {
			return !!(this.followUp || this.dueString || this.subtaskCount.total || this.showProgress || this.checklist.total)
		},
	},
	methods: {
		tbt,
		isWaitingTag: isWaitingTagName,
		isReadOnly: isTaskReadOnly,
		toggleExpanded() {
			this.$store.commit('toggleTbCardExpanded', this.task.key)
		},
		priorityClassOf(task) {
			return { high: 'priority--high', medium: 'priority--medium', low: 'priority--low' }[priorityGroup(task)] || ''
		},
		subtaskCountOf(task) {
			const subTasks = Object.values(task.subTasks || {})
			return subTasks.length ? { done: subTasks.filter(sub => sub.closed).length, total: subTasks.length } : null
		},
		/**
		 * Show the person of a subtask only if it differs from the main task
		 *
		 * @param {object} subtask The subtask
		 * @return {boolean}
		 */
		showSubAssignee(subtask) {
			const own = assigneeOf(subtask)
			return !!own && own.uid !== assigneeOf(this.task)?.uid
		},
		open($event) {
			if ($event.target.closest('.tb-card__checkbox, .tb-card__subtoggle, .tb-card__subtasks')) {
				return
			}
			if (handleSelectClick(this.$store, this.task, $event)) {
				return
			}
			this.$emit('open', this.task)
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-card {
	list-style: none;
	position: relative;
	background-color: var(--tb-card-bg, var(--color-main-background));
	border: 1px solid var(--color-border);
	border-radius: var(--tb-radius, 10px);
	padding: 8px 10px 8px 4px;
	cursor: pointer;
	display: flex;
	flex-direction: column;
	gap: 4px;
	box-shadow: 0 1px 2px rgba(0, 0, 0, .04);
	transition: box-shadow 120ms ease, border-color 120ms ease;

	&:hover,
	&:focus-visible {
		border-color: var(--color-border-dark);
		box-shadow: 0 2px 8px rgba(0, 0, 0, .08);
		outline: none;
	}

	&--active,
	&--active:hover {
		border-color: var(--color-primary-element);
		box-shadow: 0 0 0 1px var(--color-primary-element), 0 2px 8px rgba(0, 0, 0, .08);
	}

	&--selected,
	&--selected:hover {
		border-color: var(--color-primary-element);
		background-color: var(--tb-selected, var(--color-primary-element-light));
		box-shadow: 0 0 0 2px var(--color-primary-element);
	}

	&--closed .tb-card__summary {
		color: var(--color-text-maxcontrast);
		text-decoration: line-through;
	}

	&--readonly {
		cursor: default;
	}

	&.sortable-ghost {
		opacity: .5;
	}

	&__head {
		display: flex;
		align-items: flex-start;
		gap: 2px;
	}

	&__checkbox {
		flex-shrink: 0;
		margin-top: -5px;
		margin-bottom: -5px;
	}

	&__summary {
		flex-grow: 1;
		min-width: 0;
		font-size: 14px;
		font-weight: 500;
		line-height: 20px;
		overflow-wrap: anywhere;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
		padding-top: 2px;
	}

	.tb-chip--priority {
		flex-shrink: 0;
		margin-top: 2px;
	}

	&__assignee {
		margin-top: 1px;
	}

	&__context,
	&__tags,
	&__excerpt,
	&__meta {
		padding-left: 36px;
	}

	&__context {
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 12px;
		color: var(--color-text-maxcontrast);
	}

	&__calendar,
	&__parent {
		display: flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	&__bullet {
		display: inline-block;
		flex-shrink: 0;
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	&__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	&__excerpt {
		font-size: 12px;
		line-height: 17px;
		color: var(--color-text-maxcontrast);
		margin: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		overflow-wrap: anywhere;
	}

	&__meta {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 10px;
		font-size: 12px;
		color: var(--color-text-maxcontrast);
	}

	&__subtoggle {
		min-height: 0;
		height: 22px;
		margin: 0 0 0 -6px;
		padding: 0 6px 0 2px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 12px;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			background-color: var(--color-background-hover);
			color: var(--color-main-text);
		}

		.tb-card__chevron {
			transition: transform 120ms ease;
		}

		&--open .tb-card__chevron {
			transform: rotate(90deg);
		}
	}

	&__subtasks {
		list-style: none;
		margin: 2px 0 0 30px;
		padding: 2px 0 0;
		border-top: 1px solid var(--color-border);
	}

	&__subtask {
		display: flex;
		align-items: center;
		gap: 2px;
		min-height: 30px;
		padding-right: 4px;
		border-radius: 6px;
		font-size: 13px;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			background-color: var(--color-background-hover);
			outline: none;
		}

		&--active {
			background-color: var(--tb-selected, var(--color-primary-element-light));
		}

		&--closed .tb-card__subsummary {
			color: var(--color-text-maxcontrast);
			text-decoration: line-through;
		}
	}

	&__subcheckbox {
		flex-shrink: 0;
		transform: scale(.85);
		margin: -4px -4px -4px -6px;
	}

	&__subsummary {
		flex-grow: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__subcount {
		flex-shrink: 0;
		font-size: 11px;
		color: var(--color-text-maxcontrast);
	}

	&__meta-item {
		display: inline-flex;
		align-items: center;
		gap: 4px;

		&--alert {
			color: var(--tb-prio-high, #d1453b);
			font-weight: 600;
		}
	}
}
</style>
