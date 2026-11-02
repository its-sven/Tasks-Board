<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Timeline view: main tasks (projects) and their subtasks as bars from the start
to the due date. Left the tree of tasks, right the days. Drag a bar to move it
(a main task takes its subtasks along), drag its ends to change start or due.
On phones the timeline is only shown, not changed.
-->
<template>
	<div class="tb-timeline-view">
		<div v-if="!rows.length" class="tb-timeline__empty">
			{{ tbt('No tasks with a start or due date.') }}
			<template v-if="hiddenCount">
				{{ tbt('{count} hidden in the view options.', { count: hiddenCount }) }}
			</template>
		</div>
		<div v-else
			ref="scroller"
			class="tb-timeline"
			:class="{ 'tb-timeline--dragging': !!drag }"
			:style="{ maxHeight, '--tb-day': dayWidth + 'px', '--tb-left': leftWidth + 'px' }">
			<div class="tb-timeline__grid" :style="{ width: (leftWidth + timelineWidth) + 'px' }">
				<!-- Head: label and today button, months, days or weeks -->
				<div class="tb-timeline__head">
					<div class="tb-timeline__corner">
						<span class="tb-timeline__corner-label">{{ tbt('Task') }}</span>
						<NcButton variant="tertiary"
							size="small"
							class="tb-timeline__today"
							@click="scrollToToday(true)">
							{{ tbt('Today') }}
						</NcButton>
					</div>
					<div class="tb-timeline__scale" :style="{ width: timelineWidth + 'px' }">
						<div class="tb-timeline__months">
							<span v-for="month in header.months"
								:key="month.key"
								class="tb-timeline__month"
								:style="{ left: month.left + 'px', width: month.width + 'px' }">
								{{ month.label }}
							</span>
						</div>
						<div class="tb-timeline__ticks">
							<span v-for="tick in header.ticks"
								:key="tick.key"
								class="tb-timeline__tick"
								:class="{ 'tb-timeline__tick--weekend': tick.weekend, 'tb-timeline__tick--today': tick.today }"
								:style="{ left: tick.left + 'px', width: tick.width + 'px' }">
								{{ tick.label }}
							</span>
						</div>
					</div>
				</div>

				<!-- Body: weekends and today line behind the rows -->
				<div class="tb-timeline__body">
					<div class="tb-timeline__backdrop" :style="{ left: leftWidth + 'px', width: timelineWidth + 'px' }" aria-hidden="true">
						<span v-for="tick in weekendTicks"
							:key="tick.key"
							class="tb-timeline__weekend"
							:style="{ left: tick.left + 'px', width: tick.width + 'px' }" />
						<span class="tb-timeline__now" :style="{ left: todayLeft + 'px' }" />
					</div>

					<div v-for="row in rows"
						:key="row.task.key"
						class="tb-timeline__row"
						:class="{ 'tb-timeline__row--active': row.task.uri === $route.params.taskId, 'tb-timeline__row--root': row.depth === 0 }"
						:data-task-key="row.task.key">
						<div class="tb-timeline__label" :style="{ paddingInlineStart: (8 + row.depth * 18) + 'px' }">
							<button v-if="row.hasChildren"
								type="button"
								class="tb-timeline__expand no-nav"
								:class="{ 'tb-timeline__expand--open': row.expanded }"
								:disabled="filtering"
								:aria-expanded="row.expanded ? 'true' : 'false'"
								:aria-label="row.expanded ? tbt('Hide subtasks') : tbt('Show subtasks')"
								:title="row.expanded ? tbt('Hide subtasks') : tbt('Show subtasks')"
								@click.stop="toggleRow(row.task)">
								<ChevronRight :size="18" />
							</button>
							<span v-else class="tb-timeline__expand-space" />
							<span class="tb-timeline__dot" :style="{ backgroundColor: row.color }" />
							<span class="tb-timeline__title"
								:class="{ 'tb-timeline__title--closed': row.task.closed }"
								:title="row.task.summary"
								@click="openTask(row.task)">
								{{ row.task.summary }}
							</span>
							<span v-if="row.task.complete > 0" class="tb-timeline__percent">{{ row.task.complete }} %</span>
							<TbAvatar v-if="row.assignee" :person="row.assignee" :size="20" />
						</div>
						<div class="tb-timeline__lane" :style="{ width: timelineWidth + 'px' }">
							<div v-if="row.span"
								class="tb-timeline__bar"
								:class="{
									'tb-timeline__bar--milestone': row.span.milestone,
									'tb-timeline__bar--derived': row.span.derived,
									'tb-timeline__bar--outside': row.outside,
									'tb-timeline__bar--cut-start': cut(row).cutStart,
									'tb-timeline__bar--cut-end': cut(row).cutEnd,
									'tb-timeline__bar--closed': row.task.closed,
									'tb-timeline__bar--editable': row.editable,
									'tb-timeline__bar--dragged': drag && drag.keys.has(row.task.key),
								}"
								:style="barStyle(row)"
								:title="barTitle(row)"
								@pointerdown="startDrag(row, 'move', $event)">
								<template v-if="!row.span.milestone">
									<span class="tb-timeline__fill" :style="{ width: row.task.complete + '%' }" />
									<span v-if="row.editable && !row.span.derived"
										class="tb-timeline__handle tb-timeline__handle--start"
										@pointerdown.stop="startDrag(row, 'start', $event)" />
									<span v-if="row.editable && !row.span.derived"
										class="tb-timeline__handle tb-timeline__handle--end"
										@pointerdown.stop="startDrag(row, 'end', $event)" />
								</template>
								<AlertCircleOutline v-if="row.outside" :size="14" class="tb-timeline__warn" />
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
		<!-- Legend: what the colours mean -->
		<div v-if="rows.length && legend.length" class="tb-timeline__legend">
			<span v-for="entry in legend" :key="entry.key" class="tb-timeline__legend-entry">
				<span class="tb-timeline__dot" :style="{ backgroundColor: entry.color }" />
				{{ entry.label }}
			</span>
			<span class="tb-timeline__legend-entry tb-timeline__legend-entry--hint">
				<span class="tb-timeline__legend-milestone" /> {{ tbt('One date only') }}
			</span>
			<span class="tb-timeline__legend-entry tb-timeline__legend-entry--hint">
				<span class="tb-timeline__legend-derived" /> {{ tbt('From the subtasks') }}
			</span>
			<span class="tb-timeline__legend-entry tb-timeline__legend-entry--hint">
				<AlertCircleOutline :size="14" class="tb-timeline__warn" /> {{ tbt('Outside the main task') }}
			</span>
		</div>
	</div>
</template>

<script>
import { assigneeOf } from '../assignee.js'
import { boardColumn, collectBoardTasks, isFiltering } from '../board.js'
import { tableSubtaskFilter } from '../fold.js'
import { tbt } from '../l10n.js'
import { isTaskReadOnly } from '../store/board.js'
import { STATUS } from '../status.js'
import { treeRows } from '../table.js'
import { barGeometry, DEFAULT_SCALE, dragDays, headerCells, outsideParent, rowSpan, SCALES, visibleRange } from '../timeline.js'
import TbAvatar from './TbAvatar.vue'
import { uidToHexColor } from '../../utils/color.js'

import { showError } from '@nextcloud/dialogs'
import moment from '@nextcloud/moment'
import NcButton from '@nextcloud/vue/components/NcButton'

import AlertCircleOutline from 'vue-material-design-icons/AlertCircleOutline.vue'
import ChevronRight from 'vue-material-design-icons/ChevronRight.vue'

import { mapGetters } from 'vuex'

/** Colours of the states (theme variables, see theme.scss) */
const STATUS_COLORS = {
	open: 'var(--tb-viz-open)',
	inProgress: 'var(--tb-viz-inProgress)',
	waiting: 'var(--tb-viz-waiting)',
	done: 'var(--tb-viz-done)',
	cancelled: 'var(--tb-status-cancelled)',
}

export default {
	name: 'TbTimeline',
	components: {
		AlertCircleOutline,
		ChevronRight,
		NcButton,
		TbAvatar,
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
			maxHeight: 'none',
			now: moment(),
			drag: null,
			// Phones: only show (no dragging)
			touch: false,
		}
	},
	computed: {
		...mapGetters({
			searchQuery: 'searchQuery',
			filter: 'filter',
		}),
		view() {
			return this.$store.getters.tbView(this.viewKey)
		},
		scale() {
			return SCALES[this.view.timelineScale] ? this.view.timelineScale : DEFAULT_SCALE
		},
		dayWidth() {
			return SCALES[this.scale]
		},
		colorBy() {
			return ['calendar', 'assignee', 'status'].includes(this.view.timelineColor) ? this.view.timelineColor : 'calendar'
		},
		showUndated() {
			return !!this.view.timelineUndated
		},
		hiddenProjects() {
			return new Set(Array.isArray(this.view.timelineHidden) ? this.view.timelineHidden : [])
		},
		leftWidth() {
			return this.touch ? 150 : 300
		},
		filtering() {
			return isFiltering(this.searchQuery, this.filter)
		},
		showClosed() {
			return this.$store.getters.tbShowClosed
		},
		include() {
			return tableSubtaskFilter(this.collectionId, this.showClosed)
		},
		/**
		 * All main tasks of the view (before hiding projects)
		 *
		 * @return {Array}
		 */
		roots() {
			let tasks = collectBoardTasks({
				calendars: this.calendars,
				collectionId: this.collectionId,
				cards: 'root',
				searchQuery: this.searchQuery,
				filter: this.filter,
			})
			if (!this.showClosed) {
				tasks = tasks.filter(task => !task.closed)
			}
			return tasks
		},
		hiddenCount() {
			return this.roots.filter(task => this.hiddenProjects.has(task.key)).length
		},
		/**
		 * The rows: the tree of tasks with their spans, sorted by start within each level
		 *
		 * @return {Array}
		 */
		rows() {
			const include = this.include
			const spans = new Map()
			const descendants = (task, seen = new Set()) => {
				const result = []
				for (const child of Object.values(task.subTasks || {})) {
					if (seen.has(child.key) || !include(child, task)) {
						continue
					}
					seen.add(child.key)
					result.push(child, ...descendants(child, seen))
				}
				return result
			}
			const spanOf = task => {
				if (!spans.has(task.key)) {
					spans.set(task.key, rowSpan(task, descendants))
				}
				return spans.get(task.key)
			}
			const order = tasks => [...tasks].sort((a, b) => {
				const sa = spanOf(a)
				const sb = spanOf(b)
				if (sa && sb && !sa.start.isSame(sb.start, 'day')) {
					return sa.start.diff(sb.start)
				}
				if (!sa !== !sb) {
					return sa ? -1 : 1
				}
				return a.summary.localeCompare(b.summary)
			})
			const roots = this.roots.filter(task => !this.hiddenProjects.has(task.key))
			const tree = treeRows(order(roots), {
				isExpanded: task => !this.$store.getters.isTbTimelineCollapsed(task.key),
				include,
				order,
				matches: this.filtering ? task => task.matches(this.searchQuery, this.filter) : null,
			})
			const rows = []
			const parents = []
			for (const entry of tree) {
				parents.length = entry.depth
				const span = spanOf(entry.task)
				const parent = parents[entry.depth - 1] || null
				parents[entry.depth] = { span }
				if (!span && !this.showUndated) {
					continue
				}
				rows.push({
					...entry,
					span,
					outside: outsideParent(span, parent && parent.span),
					assignee: assigneeOf(entry.task),
					color: this.colorOf(entry.task),
					editable: this.canEdit(entry.task, span),
				})
			}
			return rows
		},
		range() {
			return visibleRange(this.rows.map(row => row.span), this.now)
		},
		timelineWidth() {
			return this.range.days * this.dayWidth
		},
		header() {
			return headerCells(this.range.start, this.range.days, this.scale, this.now)
		},
		weekendTicks() {
			if (this.scale === 'quarter') {
				return []
			}
			return this.header.ticks.filter(tick => tick.weekend)
		},
		todayLeft() {
			return this.now.clone().startOf('day').diff(this.range.start, 'days') * this.dayWidth + this.dayWidth / 2
		},
		legend() {
			const entries = new Map()
			for (const row of this.rows) {
				const task = row.task
				let key
				let label
				if (this.colorBy === 'assignee') {
					const person = assigneeOf(task)
					key = person ? person.uid : '-'
					label = person ? (person.displayName || person.uid) : tbt('Nobody assigned')
				} else if (this.colorBy === 'status') {
					key = boardColumn(task, this.now)
					label = tbt(STATUS[key].label)
				} else {
					key = task.calendar.id
					label = task.calendar.displayName
				}
				if (!entries.has(key)) {
					entries.set(key, { key, label, color: row.color })
				}
			}
			return [...entries.values()]
		},
	},
	watch: {
		scale() {
			this.$nextTick(() => this.scrollToToday(false))
		},
	},
	mounted() {
		this.updateTouch()
		this.updateHeight()
		window.addEventListener('resize', this.onResize)
		this.timer = setInterval(() => { this.now = moment() }, 60000)
		this.$nextTick(() => this.scrollToToday(false))
	},
	beforeUnmount() {
		window.removeEventListener('resize', this.onResize)
		clearInterval(this.timer)
		this.stopDrag()
	},
	updated() {
		this.updateHeight()
	},
	methods: {
		tbt,
		onResize() {
			this.updateTouch()
			this.updateHeight()
		},
		updateTouch() {
			this.touch = window.matchMedia('(max-width: 600px), (pointer: coarse)').matches
		},
		updateHeight() {
			const scroller = this.$refs.scroller
			if (!scroller) {
				return
			}
			const top = scroller.getBoundingClientRect().top
			const value = Math.max(240, window.innerHeight - Math.max(top, 0) - 56) + 'px'
			if (value !== this.maxHeight) {
				this.maxHeight = value
			}
		},
		/**
		 * @param {boolean} smooth Scroll smoothly (button) or jump (first view)
		 */
		scrollToToday(smooth) {
			const scroller = this.$refs.scroller
			if (!scroller) {
				return
			}
			// Only if today would be far right: then a quarter into the visible days
			// (otherwise the first days and the month would hide under the left column)
			const visible = scroller.clientWidth - this.leftWidth
			const target = this.todayLeft > visible * 2 / 3 ? this.todayLeft - visible / 4 : 0
			scroller.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' })
		},
		colorOf(task) {
			if (this.colorBy === 'assignee') {
				const person = assigneeOf(task)
				return person ? uidToHexColor(person.uid) : 'var(--color-text-maxcontrast)'
			}
			if (this.colorBy === 'status') {
				return STATUS_COLORS[boardColumn(task, this.now)]
			}
			return task.calendar.color || 'var(--color-primary-element)'
		},
		canEdit(task, span) {
			return !this.touch && !!span && !isTaskReadOnly(task) && !task.isRecurring
		},
		barStyle(row) {
			const geometry = barGeometry(row.span, this.range.start, this.dayWidth, this.range.days)
			let { left, width } = geometry
			if (this.drag && this.drag.keys.has(row.task.key)) {
				const days = dragDays(this.drag.dx, this.dayWidth) * this.dayWidth
				if (this.drag.edge === 'move' || row.task.key !== this.drag.key) {
					left += days
				} else if (this.drag.edge === 'start') {
					left = Math.min(left + days, left + width - this.dayWidth)
					width = geometry.left + geometry.width - left
				} else {
					width = Math.max(this.dayWidth, width + days)
				}
			}
			return {
				left: left + 'px',
				width: (row.span.milestone ? this.dayWidth : width) + 'px',
				'--tb-bar': row.color,
			}
		},
		/**
		 * @param {object} row The row
		 * @return {object} Whether the bar is cut off at the start or the end of the days shown
		 */
		cut(row) {
			return barGeometry(row.span, this.range.start, this.dayWidth, this.range.days)
		},
		barTitle(row) {
			const format = date => date.format('L')
			const dates = row.span.milestone ? format(row.span.start) : format(row.span.start) + ' – ' + format(row.span.end)
			const parts = [row.task.summary, dates]
			if (row.span.derived) {
				parts.push(tbt('From the subtasks'))
			}
			if (row.outside) {
				parts.push(tbt('Outside the main task'))
			}
			return parts.join(' · ')
		},
		toggleRow(task) {
			this.$store.commit('setTbTimelineCollapsed', { keys: [task.key] })
		},
		async openTask(task) {
			if (this.$route.params.taskId === task.uri) {
				return
			}
			if (this.$route.params.calendarId) {
				await this.$router.push({ name: 'calendarsTask', params: { calendarId: this.$route.params.calendarId, taskId: task.uri } })
			} else {
				await this.$router.push({ name: 'collectionsTask', params: { collectionId: this.collectionId, taskId: task.uri } })
			}
		},
		/**
		 * The task and (when moved as a whole) everything below it
		 *
		 * @param {object} task The task
		 * @param {string} edge 'move', 'start' or 'end'
		 * @return {Set<string>} Keys of the bars that move along
		 */
		movedKeys(task, edge) {
			const keys = new Set([task.key])
			if (edge !== 'move') {
				return keys
			}
			const walk = parent => {
				for (const child of Object.values(parent.subTasks || {})) {
					if (!keys.has(child.key)) {
						keys.add(child.key)
						walk(child)
					}
				}
			}
			walk(task)
			return keys
		},
		startDrag(row, edge, event) {
			if (event.button !== 0) {
				return
			}
			if (!row.editable) {
				// Only shown: a click opens the task
				this.pendingOpen = row.task
				window.addEventListener('pointerup', this.openPending, { once: true })
				return
			}
			event.preventDefault()
			this.drag = { key: row.task.key, task: row.task, edge, startX: event.clientX, dx: 0, moved: false, keys: this.movedKeys(row.task, edge) }
			window.addEventListener('pointermove', this.onDragMove)
			window.addEventListener('pointerup', this.onDragEnd, { once: true })
			window.addEventListener('keydown', this.onDragKey)
		},
		openPending() {
			if (this.pendingOpen) {
				this.openTask(this.pendingOpen)
				this.pendingOpen = null
			}
		},
		onDragMove(event) {
			if (!this.drag) {
				return
			}
			this.drag.dx = event.clientX - this.drag.startX
			if (Math.abs(this.drag.dx) > 3) {
				this.drag.moved = true
			}
		},
		onDragKey(event) {
			if (event.key === 'Escape') {
				// Cancel the drag, nothing changes
				this.stopDrag()
			}
		},
		stopDrag() {
			window.removeEventListener('pointermove', this.onDragMove)
			window.removeEventListener('pointerup', this.onDragEnd)
			window.removeEventListener('keydown', this.onDragKey)
			this.drag = null
		},
		async onDragEnd() {
			const drag = this.drag
			this.stopDrag()
			if (!drag) {
				return
			}
			if (!drag.moved) {
				this.openTask(drag.task)
				return
			}
			const days = dragDays(drag.dx, this.dayWidth)
			if (!days) {
				return
			}
			try {
				await this.$store.dispatch('tbShiftDates', { task: drag.task, days, edge: drag.edge, withSubtasks: drag.edge === 'move' })
			} catch (error) {
				console.error(error)
				showError(tbt('The dates could not be changed.'))
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-timeline-view {
	padding: calc(2 * var(--default-grid-baseline)) calc(3 * var(--default-grid-baseline)) calc(3 * var(--default-grid-baseline));
}

.tb-timeline__empty {
	padding: 48px 16px;
	text-align: center;
	color: var(--color-text-maxcontrast);
}

.tb-timeline {
	--tb-row-h: 36px;
	position: relative;
	overflow: auto;
	border: 1px solid var(--color-border);
	border-radius: 12px;
	background-color: var(--tb-card-bg, var(--color-main-background));
	font-size: 14px;

	&--dragging {
		cursor: grabbing;
		user-select: none;
	}

	&__grid {
		position: relative;
	}

	&__head {
		position: sticky;
		top: 0;
		z-index: 3;
		display: flex;
		background-color: var(--tb-card-bg, var(--color-main-background));
		border-bottom: 1px solid var(--color-border);
	}

	&__corner {
		position: sticky;
		left: 0;
		z-index: 4;
		display: flex;
		align-items: center;
		justify-content: space-between;
		flex: 0 0 var(--tb-left);
		width: var(--tb-left);
		padding: 0 8px 0 12px;
		border-right: 1px solid var(--color-border);
		background-color: inherit;
		font-weight: 600;
		color: var(--color-text-maxcontrast);
	}

	&__scale {
		position: relative;
		flex: 0 0 auto;
		height: 52px;
	}

	&__months,
	&__ticks {
		position: relative;
		height: 26px;
	}

	&__month,
	&__tick {
		position: absolute;
		top: 0;
		overflow: hidden;
		height: 26px;
		line-height: 26px;
		white-space: nowrap;
		text-overflow: clip;
		border-left: 1px solid var(--color-border);
	}

	&__month {
		padding-inline-start: 6px;
		font-weight: 600;
	}

	&__tick {
		text-align: center;
		font-size: 11px;
		color: var(--color-text-maxcontrast);

		&--weekend {
			background-color: var(--color-background-hover);
		}

		&--today {
			color: var(--color-primary-element);
			font-weight: 700;
		}
	}

	&__body {
		position: relative;
	}

	&__backdrop {
		position: absolute;
		top: 0;
		bottom: 0;
		pointer-events: none;
	}

	&__weekend {
		position: absolute;
		top: 0;
		bottom: 0;
		background-color: color-mix(in srgb, var(--color-background-hover) 60%, transparent);
	}

	&__now {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		margin-left: -1px;
		background-color: var(--color-primary-element);
		opacity: .7;
	}

	&__row {
		display: flex;
		height: var(--tb-row-h);
		border-bottom: 1px solid color-mix(in srgb, var(--color-border) 60%, transparent);

		&--root {
			font-weight: 600;
		}

		&--active .tb-timeline__label {
			background-color: color-mix(in srgb, var(--color-primary-element) 14%, var(--tb-card-bg, var(--color-main-background)));
		}

		&:hover .tb-timeline__label {
			background-color: var(--color-background-hover);
		}
	}

	&__label {
		position: sticky;
		left: 0;
		z-index: 2;
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 0 0 var(--tb-left);
		width: var(--tb-left);
		min-width: 0;
		padding-inline-end: 8px;
		border-right: 1px solid var(--color-border);
		background-color: var(--tb-card-bg, var(--color-main-background));
	}

	&__expand,
	&__expand-space {
		flex: 0 0 22px;
		width: 22px;
	}

	// Twice: the button rule of the server (margin: 3px) is more specific
	&__expand.tb-timeline__expand {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 26px;
		min-height: 0;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-text-maxcontrast);
		cursor: pointer;

		&:hover:not([disabled]) {
			background-color: var(--color-background-hover);
		}

		:deep(.material-design-icon) {
			transition: transform 120ms ease;
		}
	}

	&__expand--open :deep(.material-design-icon) {
		transform: rotate(90deg);
	}

	&__dot {
		flex: 0 0 auto;
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	&__title {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		cursor: pointer;

		&--closed {
			text-decoration: line-through;
			color: var(--color-text-maxcontrast);
		}
	}

	&__percent {
		flex: 0 0 auto;
		font-size: 12px;
		font-weight: normal;
		color: var(--color-text-maxcontrast);
	}

	// Phones: the title gets the narrow column
	@media only screen and (max-width: 600px) {
		&__percent,
		&__corner-label,
		&__label :deep(.tb-avatar) {
			display: none;
		}
	}

	&__lane {
		position: relative;
		flex: 0 0 auto;
	}

	&__bar {
		position: absolute;
		top: 7px;
		height: calc(var(--tb-row-h) - 14px);
		overflow: visible;
		border-radius: 6px;
		background-color: color-mix(in srgb, var(--tb-bar) 30%, var(--tb-card-bg, var(--color-main-background)));
		border: 1px solid var(--tb-bar);
		cursor: pointer;

		&--editable {
			cursor: grab;
		}

		&--dragged {
			opacity: .85;
			box-shadow: 0 2px 8px rgba(0, 0, 0, .2);
		}

		&--derived {
			border-style: dashed;
			background-color: color-mix(in srgb, var(--tb-bar) 12%, transparent);
		}

		&--closed {
			opacity: .55;
		}

		&--outside {
			outline: 2px solid var(--tb-viz-overdue);
			outline-offset: 1px;
		}

		// Goes on beyond the days shown
		&--cut-start {
			border-left-style: dotted;
			border-top-left-radius: 0;
			border-bottom-left-radius: 0;
		}

		&--cut-end {
			border-right-style: dotted;
			border-top-right-radius: 0;
			border-bottom-right-radius: 0;
		}

		&--milestone {
			top: calc(var(--tb-row-h) / 2 - 8px);
			width: 16px !important;
			height: 16px;
			margin-left: calc(var(--tb-day) / 2 - 8px);
			border-radius: 3px;
			transform: rotate(45deg);
			background-color: var(--tb-bar);
		}
	}

	&__fill {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 0;
		max-width: 100%;
		border-radius: 5px 0 0 5px;
		background-color: var(--tb-bar);
		opacity: .55;
		pointer-events: none;
	}

	&__handle {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 8px;
		cursor: ew-resize;

		&--start {
			left: -3px;
		}

		&--end {
			right: -3px;
		}
	}

	&__warn {
		position: absolute;
		top: 50%;
		right: -20px;
		transform: translateY(-50%);
		color: var(--tb-viz-overdue);
	}

	&__bar--milestone &__warn {
		transform: rotate(-45deg);
	}
}

.tb-timeline__legend {
	display: flex;
	flex-wrap: wrap;
	gap: 6px 16px;
	padding: 10px 4px 0;
	font-size: 12px;
	color: var(--color-text-maxcontrast);

	&-entry {
		display: inline-flex;
		align-items: center;
		gap: 6px;

		.tb-timeline__warn {
			position: static;
			transform: none;
		}
	}

	&-milestone {
		width: 10px;
		height: 10px;
		border-radius: 2px;
		transform: rotate(45deg);
		background-color: var(--color-text-maxcontrast);
	}

	&-derived {
		width: 22px;
		height: 10px;
		border: 1px dashed var(--color-text-maxcontrast);
		border-radius: 3px;
	}
}
</style>
