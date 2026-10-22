<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Dashboard: what is open, on whom, in which list or project, what needs
attention and how it developed. Filters (list, project, person, tag) apply to
everything below them. A click on a task opens it in the sidebar.
-->
<template>
	<div class="tb-dash">
		<div class="tb-dash__head">
			<h2 class="tb-dash__title">
				{{ tbt('Dashboard') }}
			</h2>
			<span v-if="loading" class="tb-dash__loading">
				<NcLoadingIcon :size="16" />
				{{ tbt('Loading completed tasks …') }}
			</span>
		</div>

		<div class="tb-dash__filters" role="group" :aria-label="tbt('Filter')">
			<!-- Own label and placeholder: they look the same in all versions of NcSelect -->
			<div class="tb-dash__filter"
				:class="{ 'tb-dash__filter--empty': !selectedCalendars.length }"
				:data-placeholder="tbt('All lists')">
				<label for="tb-dash-lists" class="tb-dash__label">{{ tbt('Lists') }}</label>
				<NcSelect input-id="tb-dash-lists"
					:model-value="selectedCalendars"
					:options="calendarChoices"
					label="displayName"
					:multiple="true"
					:limit="2"
					:no-wrap="true"
					:close-on-select="false"
					:label-outside="true"
					:placeholder="tbt('All lists')"
					@update:model-value="setFilter({ dashCalendars: $event.map(calendar => calendar.id), dashProject: null })">
					<template #option="option">
						<span class="tb-dash__option">
							<span class="tb-dash__dot" :style="{ 'background-color': option.color }" />
							{{ option.displayName }}
						</span>
					</template>
				</NcSelect>
			</div>
			<div class="tb-dash__filter"
				:class="{ 'tb-dash__filter--empty': !selectedProject }"
				:data-placeholder="tbt('All projects')">
				<label for="tb-dash-project" class="tb-dash__label">{{ tbt('Project (main task)') }}</label>
				<!-- One project at a time: a new choice replaces the old one -->
				<NcSelect input-id="tb-dash-project"
					:model-value="selectedProject ? [selectedProject] : []"
					:options="projectChoices"
					label="summary"
					:multiple="true"
					:no-wrap="true"
					:label-outside="true"
					@update:model-value="setFilter({ dashProject: $event.length ? $event[$event.length - 1].key : null })" />
			</div>
			<div class="tb-dash__filter"
				:class="{ 'tb-dash__filter--empty': !selectedPeople.length }"
				:data-placeholder="tbt('Everyone')">
				<label for="tb-dash-people" class="tb-dash__label">{{ tbt('People') }}</label>
				<NcSelect input-id="tb-dash-people"
					:model-value="selectedPeople"
					:options="peopleOptions"
					label="displayName"
					:multiple="true"
					:limit="2"
					:no-wrap="true"
					:close-on-select="false"
					:label-outside="true"
					:placeholder="tbt('Everyone')"
					@update:model-value="setFilter({ dashPeople: $event.map(person => person.uid) })" />
			</div>
			<div class="tb-dash__filter"
				:class="{ 'tb-dash__filter--empty': !filters.tags.length }"
				:data-placeholder="tbt('All tags')">
				<label for="tb-dash-tags" class="tb-dash__label">{{ tbt('Tags') }}</label>
				<NcSelect input-id="tb-dash-tags"
					:model-value="filters.tags"
					:options="tagChoices"
					:multiple="true"
					:limit="2"
					:no-wrap="true"
					:close-on-select="false"
					:label-outside="true"
					:placeholder="tbt('All tags')"
					@update:model-value="setFilter({ dashTags: $event })" />
			</div>
			<NcCheckboxRadioSwitch type="switch"
				class="tb-dash__switch"
				:model-value="filters.rootOnly"
				@update:model-value="setFilter({ dashRootOnly: $event })">
				{{ tbt('Main tasks only') }}
			</NcCheckboxRadioSwitch>
			<NcButton v-if="filtered"
				variant="tertiary"
				@click="resetFilters">
				<template #icon>
					<FilterRemoveOutline :size="20" />
				</template>
				{{ tbt('Reset filters') }}
			</NcButton>
		</div>

		<div class="tb-dash__body" :class="{ 'tb-dash__body--loading': loading }">
			<!-- Headline numbers -->
			<ul class="tb-dash__tiles">
				<li v-for="tile in tiles" :key="tile.key" class="tb-dash__tile">
					<span class="tb-dash__tile-label">
						<span v-if="tile.color" class="tb-dash__swatch" :style="{ 'background-color': 'var(--tb-viz-' + tile.color + ')' }" />
						<component :is="tile.icon" v-else-if="tile.icon" :size="16" />
						{{ tile.label }}
					</span>
					<span class="tb-dash__tile-value">{{ tile.value }}</span>
					<span v-if="tile.hint" class="tb-dash__tile-hint">{{ tile.hint }}</span>
				</li>
			</ul>

			<div class="tb-dash__grid">
				<!-- Status -->
				<section class="tb-dash__card">
					<header class="tb-dash__card-head">
						<h3>{{ tbt('Status of the open tasks') }}</h3>
					</header>
					<TbDashRing :segments="ringSegments"
						:total="numbers.remaining"
						:center-label="tbt('open tasks')" />
				</section>

				<!-- Distribution -->
				<section v-for="part in breakdowns"
					:key="part.dimension"
					class="tb-dash__card">
					<header class="tb-dash__card-head">
						<h3>{{ part.title }}</h3>
						<button type="button"
							class="tb-dash__view-toggle"
							:aria-pressed="tableViews[part.dimension] ? 'true' : 'false'"
							@click="toggleTable(part.dimension)">
							<TableLarge v-if="!tableViews[part.dimension]" :size="16" />
							<ChartBar v-else :size="16" />
							{{ tableViews[part.dimension] ? tbt('Chart') : tbt('Table') }}
						</button>
					</header>
					<p v-if="part.dimension === 'tag'" class="tb-dash__note">
						{{ tbt('A task with several tags counts once per tag.') }}
					</p>
					<TbDashBars :groups="part.groups"
						:states="stateLegend"
						:as-table="!!tableViews[part.dimension]"
						:group-label="part.groupLabel"
						:total-label="tbt('Total')"
						:empty-label="tbt('No open tasks')"
						:pick-title="part.pickTitle"
						:active="part.active"
						:not-pickable="part.notPickable"
						@pick="pick(part.dimension, $event)" />
					<div v-if="!tableViews[part.dimension] && part.groups.length" class="tb-dash__legend">
						<span v-for="state in stateLegend" :key="state.key" class="tb-dash__legend-item">
							<span class="tb-dash__swatch" :style="{ 'background-color': 'var(--tb-viz-' + state.key + ')' }" />
							{{ state.label }}
						</span>
					</div>
				</section>

				<!-- Needs attention -->
				<section class="tb-dash__card tb-dash__card--wide">
					<header class="tb-dash__card-head">
						<h3>{{ tbt('Needs attention') }}</h3>
					</header>
					<div class="tb-dash__attention">
						<div v-for="list in attentionLists" :key="list.key" class="tb-dash__attention-list">
							<h4>
								<component :is="list.icon" :size="16" />
								{{ list.title }}
								<span class="tb-dash__count">{{ list.tasks.length }}</span>
							</h4>
							<p class="tb-dash__note">
								{{ list.hint }}
							</p>
							<ul v-if="list.tasks.length">
								<li v-for="task in list.tasks.slice(0, expanded[list.key] ? 50 : 6)" :key="task.key">
									<button type="button"
										class="tb-dash__task"
										:class="{ 'tb-dash__task--active': isOpen(task) }"
										:data-task-key="task.key"
										@click="openTask(task)">
										<span class="tb-dash__dot" :style="{ 'background-color': task.calendar.color }" />
										<span class="tb-dash__task-name">{{ task.summary }}</span>
										<span class="tb-dash__task-meta">{{ list.meta(task) }}</span>
									</button>
								</li>
							</ul>
							<p v-else class="tb-dash__empty">
								{{ tbt('Nothing here') }}
							</p>
							<NcButton v-if="list.tasks.length > 6"
								variant="tertiary"
								size="small"
								@click="expanded = { ...expanded, [list.key]: !expanded[list.key] }">
								{{ expanded[list.key] ? tbt('Show less') : tbt('Show {count} more', { count: Math.min(list.tasks.length, 50) - 6 }) }}
							</NcButton>
						</div>
					</div>
				</section>

				<!-- History -->
				<section class="tb-dash__card tb-dash__card--wide">
					<header class="tb-dash__card-head">
						<h3>{{ tbt('New and completed per week') }}</h3>
						<button type="button"
							class="tb-dash__view-toggle"
							:aria-pressed="tableViews.history ? 'true' : 'false'"
							@click="toggleTable('history')">
							<TableLarge v-if="!tableViews.history" :size="16" />
							<ChartBar v-else :size="16" />
							{{ tableViews.history ? tbt('Chart') : tbt('Table') }}
						</button>
					</header>
					<TbDashHistory :weeks="history"
						:series-list="historySeries"
						:as-table="!!tableViews.history"
						:week-label="tbt('Week')"
						:week-prefix="tbt('Wk')" />
				</section>
			</div>
		</div>
	</div>
</template>

<script>
import { assigneeOf } from '../assignee.js'
import { shortDate } from '../dates.js'
import { isWaitingTagName, priorityGroup } from '../board.js'
import { tbt } from '../l10n.js'
import {
	attention,
	breakdown,
	dashboardTasks,
	filterTasks,
	NOBODY,
	projectOptions,
	STALE_DAYS,
	summary,
	weeklyHistory,
	WORK_STATES,
} from '../stats.js'
import { tagOptions } from '../taglist.js'
import TbDashBars from '../components/TbDashBars.vue'
import TbDashHistory from '../components/TbDashHistory.vue'
import TbDashRing from '../components/TbDashRing.vue'

import moment from '@nextcloud/moment'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'
import NcSelect from '@nextcloud/vue/components/NcSelect'

import AccountQuestionOutline from 'vue-material-design-icons/AccountQuestionOutline.vue'
import AlertCircleOutline from 'vue-material-design-icons/AlertCircleOutline.vue'
import BellAlertOutline from 'vue-material-design-icons/BellAlertOutline.vue'
import ChartBar from 'vue-material-design-icons/ChartBar.vue'
import CheckCircleOutline from 'vue-material-design-icons/CheckCircleOutline.vue'
import FilterRemoveOutline from 'vue-material-design-icons/FilterRemoveOutline.vue'
import SleepIcon from 'vue-material-design-icons/Sleep.vue'
import TableLarge from 'vue-material-design-icons/TableLarge.vue'

/** View settings key of the dashboard (stored with the other views) */
const VIEW_KEY = 'dashboard'

/** Lists whose completed tasks were loaded for the dashboard (this page load) */
const loadedCompleted = new Set()

export default {
	name: 'TbDashboard',
	components: {
		ChartBar,
		FilterRemoveOutline,
		NcButton,
		NcCheckboxRadioSwitch,
		NcLoadingIcon,
		NcSelect,
		TbDashBars,
		TbDashHistory,
		TbDashRing,
		TableLarge,
	},
	data() {
		return {
			loading: false,
			now: moment(),
			expanded: {},
			tableViews: {},
		}
	},
	computed: {
		view() {
			return this.$store.getters.tbView(VIEW_KEY)
		},
		filters() {
			return {
				calendars: this.view.dashCalendars || [],
				project: this.view.dashProject || null,
				people: this.view.dashPeople || [],
				tags: this.view.dashTags || [],
				rootOnly: !!this.view.dashRootOnly,
			}
		},
		filtered() {
			const f = this.filters
			return f.calendars.length > 0 || !!f.project || f.people.length > 0 || f.tags.length > 0 || f.rootOnly
		},
		calendarOptions() {
			const templateId = this.$store.getters.tbTemplateCalendar?.id
			return this.$store.getters.getSortedCalendars.filter(calendar => calendar.supportsTasks !== false && calendar.id !== templateId)
		},
		/** Plain objects for the selects (they only read own properties) */
		calendarChoices() {
			return this.calendarOptions.map(calendar => ({ id: calendar.id, displayName: calendar.displayName, color: calendar.color }))
		},
		selectedCalendars() {
			return this.calendarChoices.filter(calendar => this.filters.calendars.includes(calendar.id))
		},
		allTasks() {
			return dashboardTasks(this.calendarOptions)
		},
		projectChoices() {
			const tasks = this.filters.calendars.length
				? this.allTasks.filter(task => this.filters.calendars.includes(task.calendar.id))
				: this.allTasks
			return projectOptions(tasks).map(task => ({ key: task.key, summary: task.summary }))
		},
		selectedProject() {
			const task = this.allTasks.find(task => task.key === this.filters.project)
			return task ? { key: task.key, summary: task.summary } : null
		},
		peopleOptions() {
			const people = new Map()
			for (const task of this.allTasks) {
				const person = assigneeOf(task)
				if (person?.uid && !people.has(person.uid)) {
					people.set(person.uid, { uid: person.uid, displayName: person.displayName || person.uid })
				}
			}
			const sorted = [...people.values()].sort((a, b) => a.displayName.localeCompare(b.displayName))
			return [...sorted, { uid: NOBODY, displayName: tbt('Not assigned') }]
		},
		selectedPeople() {
			return this.peopleOptions.filter(person => this.filters.people.includes(person.uid))
		},
		tagChoices() {
			return tagOptions(this.$store.getters.tbTagList || [], this.$store.getters.tags || [])
				.filter(tag => !isWaitingTagName(tag))
		},
		tasks() {
			return filterTasks(this.allTasks, this.filters)
		},
		numbers() {
			return summary(this.tasks, this.now)
		},
		stateLegend() {
			return WORK_STATES.map(key => ({ key, label: this.stateLabel(key) }))
		},
		ringSegments() {
			return WORK_STATES.map(key => ({ key, label: this.stateLabel(key), value: this.numbers[key] }))
		},
		tiles() {
			const n = this.numbers
			return [
				{ key: 'inProgress', label: this.stateLabel('inProgress'), value: n.inProgress, color: 'inProgress' },
				{ key: 'waiting', label: this.stateLabel('waiting'), value: n.waiting, color: 'waiting' },
				{ key: 'open', label: this.stateLabel('open'), value: n.open, color: 'open' },
				{ key: 'overdue', label: this.stateLabel('overdue'), value: n.overdue, color: 'overdue' },
				{ key: 'done', label: tbt('Done this week'), value: n.doneThisWeek, icon: CheckCircleOutline, hint: tbt('{count} in the last 30 days', { count: n.done30 }) },
				{ key: 'followup', label: tbt('Follow-up due'), value: n.followUps, icon: BellAlertOutline },
			]
		},
		breakdowns() {
			const f = this.filters
			const label = (dimension, group) => {
				if (group.key === '__other__') {
					return tbt('{count} more', { count: group.other })
				}
				if (group.label !== null) {
					return dimension === 'priority' ? this.priorityLabel(group.label) : group.label
				}
				return { person: tbt('Not assigned'), project: tbt('Without project (single tasks)'), tag: tbt('Without tag') }[dimension] || '–'
			}
			const make = (dimension, title, groupLabel, pickTitle, active, notPickable = ['__other__']) => ({
				dimension,
				title,
				groupLabel,
				pickTitle,
				active,
				notPickable,
				groups: breakdown(this.tasks, dimension, { now: this.now }).map(group => ({ ...group, label: label(dimension, group) })),
			})
			return [
				make('person', tbt('Open tasks per person'), tbt('Person'), tbt('Show only this person'),
					f.people.length === 1 ? (f.people[0] === NOBODY ? NOBODY : 'user:' + f.people[0]) : null),
				make('calendar', tbt('Open tasks per list'), tbt('List'), tbt('Show only this list'),
					f.calendars.length === 1 ? 'calendar:' + f.calendars[0] : null),
				make('project', tbt('Open tasks per project'), tbt('Project'), tbt('Show only this project'),
					f.project ? 'project:' + f.project : null, ['__other__', '__single__']),
				make('priority', tbt('Open tasks per priority'), tbt('Priority'), '', null, ['priority:high', 'priority:medium', 'priority:low', 'priority:none']),
				make('tag', tbt('Open tasks per tag'), tbt('Tag'), tbt('Show only this tag'),
					f.tags.length === 1 ? 'tag:' + f.tags[0].toLowerCase() : null, ['__other__', '__notag__']),
			]
		},
		attentionLists() {
			const lists = attention(this.tasks, this.now)
			const date = (value) => shortDate(value)
			const person = (task) => assigneeOf(task)?.displayName || ''
			return [
				{ key: 'overdue', title: this.stateLabel('overdue'), icon: AlertCircleOutline, tasks: lists.overdue, hint: tbt('Open and due before today'), meta: task => [person(task), tbt('due {date}', { date: date(task.dueMoment) })].filter(Boolean).join(' · ') },
				{ key: 'followups', title: tbt('Follow-up due'), icon: BellAlertOutline, tasks: lists.followUps, hint: tbt('Waiting, the follow-up date is reached'), meta: task => [person(task), date(task.startMoment)].filter(Boolean).join(' · ') },
				{ key: 'unassigned', title: tbt('Not assigned'), icon: AccountQuestionOutline, tasks: lists.unassigned, hint: tbt('Open, nobody responsible'), meta: task => this.priorityLabel(priorityGroup(task)) },
				{ key: 'stale', title: tbt('Lying around'), icon: SleepIcon, tasks: lists.stale, hint: tbt('Important (1–4), unchanged for {days} days', { days: STALE_DAYS }), meta: task => [person(task), tbt('changed {date}', { date: date(task.modifiedMoment) })].filter(Boolean).join(' · ') },
			]
		},
		history() {
			return weeklyHistory(this.tasks, { now: this.now })
		},
		historySeries() {
			return [
				{ key: 'created', label: tbt('New'), color: 'new' },
				{ key: 'completed', label: tbt('Completed'), color: 'done' },
			]
		},
	},
	watch: {
		calendarOptions() {
			this.loadCompleted()
		},
	},
	mounted() {
		this.loadCompleted()
		this.timer = setInterval(() => { this.now = moment() }, 60000)
	},
	beforeUnmount() {
		clearInterval(this.timer)
	},
	methods: {
		tbt,
		stateLabel(key) {
			return {
				inProgress: tbt('In progress'),
				waiting: tbt('Waiting'),
				open: tbt('Open'),
				overdue: tbt('Overdue'),
			}[key]
		},
		priorityLabel(group) {
			return {
				high: tbt('Important (1–4)'),
				medium: tbt('Normal (5)'),
				low: tbt('Someday (6–9)'),
				none: tbt('No priority'),
			}[group] || group
		},
		setFilter(patch) {
			this.$store.dispatch('setTbView', { key: VIEW_KEY, patch })
		},
		resetFilters() {
			this.setFilter({ dashCalendars: [], dashProject: null, dashPeople: [], dashTags: [], dashRootOnly: false })
		},
		toggleTable(key) {
			this.tableViews = { ...this.tableViews, [key]: !this.tableViews[key] }
		},
		/**
		 * A click on a bar filters by it (click again: filter off)
		 *
		 * @param {string} dimension person, calendar, project or tag
		 * @param {object} group The group of the bar
		 */
		pick(dimension, group) {
			const key = group.key
			switch (dimension) {
			case 'person': {
				const uid = key === NOBODY ? NOBODY : key.replace(/^user:/, '')
				const only = this.filters.people.length === 1 && this.filters.people[0] === uid
				this.setFilter({ dashPeople: only ? [] : [uid] })
				break
			}
			case 'calendar': {
				const id = key.replace(/^calendar:/, '')
				const only = this.filters.calendars.length === 1 && this.filters.calendars[0] === id
				this.setFilter({ dashCalendars: only ? [] : [id], dashProject: null })
				break
			}
			case 'project': {
				const projectKey = key.replace(/^project:/, '')
				this.setFilter({ dashProject: this.filters.project === projectKey ? null : projectKey })
				break
			}
			case 'tag': {
				const only = this.filters.tags.length === 1 && this.filters.tags[0].toLowerCase() === group.label.toLowerCase()
				this.setFilter({ dashTags: only ? [] : [group.label] })
				break
			}
			}
		},
		isOpen(task) {
			return this.$route.params.taskId === task.uri && this.$route.params.calendarId === task.calendar.id
		},
		openTask(task) {
			if (this.isOpen(task)) {
				return
			}
			this.$router.push({ name: 'dashboardTask', params: { calendarId: task.calendar.id, taskId: task.uri } })
		},
		/** Completed tasks count for "done this week" and the history */
		async loadCompleted() {
			const missing = this.calendarOptions.filter(calendar => !loadedCompleted.has(calendar.id))
			if (!missing.length) {
				return
			}
			missing.forEach(calendar => loadedCompleted.add(calendar.id))
			this.loading = true
			try {
				await Promise.all(missing.map(calendar => this.$store.dispatch('getTasksFromCalendar', { calendar, completed: true, related: null })
					.catch(error => {
						loadedCompleted.delete(calendar.id)
						console.error('Could not load the completed tasks of ' + calendar.displayName, error)
					})))
			} finally {
				this.loading = false
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-dash {
	min-height: 100%;
	padding: 10px 16px 32px calc(4 * var(--default-grid-baseline) + var(--default-clickable-area));
	background-color: var(--color-main-background);

	@media only screen and (max-width: 1024px) {
		padding-left: calc(2 * var(--default-grid-baseline) + var(--default-clickable-area));
		padding-right: 8px;
	}

	&__head {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 44px;
	}

	&__title {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
	}

	&__loading {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-maxcontrast);
		font-size: 13px;
	}

	&__filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 8px 12px;
		margin: 6px 0 16px;
	}

	&__filter {
		display: grid;
		flex: 1 1 170px;
		grid-template-rows: auto auto;
		gap: 2px;
		max-width: 250px;
		min-width: 150px;

		:deep(.v-select.select) {
			grid-row: 2;
			grid-column: 1;
			width: 100%;
			min-width: 0;
			margin: 0 !important;
		}

		// Placeholder over the empty field (NcSelect shows none for multiple choice)
		&--empty::after {
			content: attr(data-placeholder);
			grid-row: 2;
			grid-column: 1;
			align-self: center;
			z-index: 1;
			overflow: hidden;
			padding-inline: 14px 44px;
			color: var(--color-text-maxcontrast);
			white-space: nowrap;
			text-overflow: ellipsis;
			pointer-events: none;
		}

		&--empty:focus-within::after {
			visibility: hidden;
		}
	}

	&__label {
		color: var(--color-text-maxcontrast);
		font-size: var(--font-size-small, 13px);
		padding-inline-start: 2px;
	}

	&__switch {
		min-height: 36px;
	}

	&__option {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	&__dot {
		flex: 0 0 auto;
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}

	&__body {
		transition: opacity 150ms ease;

		&--loading {
			opacity: .75;
		}
	}

	&__tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: 12px;
		margin: 0 0 16px;
		padding: 0;
		list-style: none;
	}

	&__tile {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 12px 14px;
		border: 1px solid var(--color-border);
		border-radius: 12px;
		background-color: var(--tb-card-bg, var(--color-main-background));
	}

	&__tile-label {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-text-maxcontrast);
		font-size: 13px;
	}

	&__tile-value {
		font-size: 28px;
		font-weight: 600;
		line-height: 1.2;
	}

	&__tile-hint {
		color: var(--color-text-maxcontrast);
		font-size: 12px;
	}

	&__swatch {
		display: inline-block;
		flex: 0 0 auto;
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}

	&__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		align-items: start;
		gap: 16px;
	}

	&__card {
		position: relative;
		min-width: 0;
		padding: 14px 16px 16px;
		border: 1px solid var(--color-border);
		border-radius: 12px;
		background-color: var(--tb-card-bg, var(--color-main-background));

		&--wide {
			grid-column: 1 / -1;
		}
	}

	&__card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		margin-bottom: 10px;

		h3 {
			margin: 0;
			font-size: 15px;
			font-weight: 600;
		}
	}

	&__view-toggle {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		min-height: 28px;
		margin: 0;
		padding: 0 8px;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: transparent;
		color: var(--color-text-maxcontrast);
		font-size: 12px;
		font-weight: normal;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			background-color: var(--color-background-hover);
			color: var(--color-main-text);
		}
	}

	&__note {
		margin: -4px 0 8px;
		color: var(--color-text-maxcontrast);
		font-size: 12px;
	}

	&__legend {
		display: flex;
		flex-wrap: wrap;
		gap: 4px 14px;
		margin-top: 10px;
		font-size: 12px;
	}

	&__legend-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	&__attention {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: 16px 24px;

		h4 {
			display: flex;
			align-items: center;
			gap: 6px;
			margin: 0 0 2px;
			font-size: 14px;
			font-weight: 600;
		}

		ul {
			margin: 0;
			padding: 0;
			list-style: none;
		}
	}

	&__count {
		margin-left: auto;
		padding: 0 8px;
		border-radius: 999px;
		background-color: var(--color-background-dark);
		font-size: 12px;
		font-variant-numeric: tabular-nums;
	}

	&__task {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 34px;
		margin: 0;
		padding: 2px 8px;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: var(--color-main-text);
		font: inherit;
		font-weight: normal;
		text-align: start;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			background-color: var(--color-background-hover);
		}

		&--active {
			background-color: var(--tb-selected, var(--color-primary-element-light));
		}
	}

	&__task-name {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__task-meta {
		flex: 0 0 auto;
		max-width: 45%;
		overflow: hidden;
		color: var(--color-text-maxcontrast);
		font-size: 12px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__empty {
		margin: 4px 8px;
		color: var(--color-text-maxcontrast);
		font-size: 13px;
	}
}
</style>
