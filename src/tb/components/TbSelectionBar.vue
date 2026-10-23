<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Floating bar at the bottom of the list/board while tasks are selected:
actions for all selected tasks at once.
-->
<template>
	<div v-if="active"
		class="tb-selection-bar"
		:style="position"
		role="toolbar"
		:aria-label="tbt('Actions for the selected tasks')">
		<span class="tb-selection-bar__count">
			{{ count ? tbt('{count} selected', { count }) : tbt('Click tasks to select them') }}
		</span>
		<template v-if="count">
			<NcButton variant="tertiary" :disabled="busy" @click="run('complete')">
				<template #icon>
					<CheckAll :size="20" />
				</template>
				{{ tbt('Complete') }}
			</NcButton>

			<NcActions variant="tertiary" :menu-name="tbt('Status')" :disabled="busy">
				<template #icon>
					<ListStatus :size="20" />
				</template>
				<NcActionButton v-for="column in columns"
					:key="column.id"
					:close-after-click="true"
					@click="setColumn(column.id)">
					<template #icon>
						<span class="tb-menu-icon">
							<span class="tb-selection-bar__dot" :class="'tb-selection-bar__dot--' + column.id" />
						</span>
					</template>
					{{ column.label }}
				</NcActionButton>
				<NcActionSeparator />
				<NcActionButton :close-after-click="true" @click="run('reopen')">
					<template #icon>
						<Restore :size="20" />
					</template>
					{{ tbt('Reopen') }}
				</NcActionButton>
			</NcActions>

			<NcActions variant="tertiary"
				:menu-name="tbt('Person')"
				:disabled="busy"
				@open="loadPeople">
				<template #icon>
					<AccountOutline :size="20" />
				</template>
				<NcActionCaption v-if="!people.length" :name="tbt('Only persons with access to all lists of the selection')" />
				<NcActionButton v-for="person in people"
					:key="person.uid"
					:close-after-click="true"
					@click="run('assign', person)">
					<template #icon>
						<span class="tb-menu-icon">
							<TbAvatar :person="person" :size="20" />
						</span>
					</template>
					{{ person.displayName }}
				</NcActionButton>
				<NcActionSeparator />
				<NcActionButton :close-after-click="true" @click="run('assign', null)">
					<template #icon>
						<AccountOffOutline :size="20" />
					</template>
					{{ tbt('Not assigned') }}
				</NcActionButton>
			</NcActions>

			<NcActions variant="tertiary" :menu-name="tbt('Tag')" :disabled="busy">
				<template #icon>
					<TagPlusOutline :size="20" />
				</template>
				<NcActionInput :model-value="newTag"
					:label="tbt('New tag')"
					:show-trailing-button="!!newTag.trim()"
					@update:model-value="newTag = $event"
					@submit="addNewTag">
					<template #icon>
						<Plus :size="20" />
					</template>
				</NcActionInput>
				<NcActionButton v-for="tag in tagsToAdd"
					:key="'add-' + tag"
					:close-after-click="false"
					@click="run('addTag', tag)">
					<template #icon>
						<Plus :size="20" />
					</template>
					{{ tag }}
				</NcActionButton>
				<template v-if="tagsToRemove.length">
					<NcActionSeparator />
					<NcActionCaption :name="tbt('Remove')" />
					<NcActionButton v-for="tag in tagsToRemove"
						:key="'remove-' + tag"
						:close-after-click="false"
						@click="run('removeTag', tag)">
						<template #icon>
							<Minus :size="20" />
						</template>
						{{ tag }}
					</NcActionButton>
				</template>
			</NcActions>

			<NcActions variant="tertiary" :menu-name="tbt('Priority')" :disabled="busy">
				<template #icon>
					<StarOutline :size="20" />
				</template>
				<NcActionButton v-for="option in priorities"
					:key="option.value"
					:close-after-click="true"
					@click="run('priority', option.value)">
					<template #icon>
						<StarOutline :size="20" :class="'tb-selection-bar__prio--' + option.group" />
					</template>
					{{ option.label }}
				</NcActionButton>
			</NcActions>

			<NcActions variant="tertiary" :menu-name="tbt('Due')" :disabled="busy">
				<template #icon>
					<CalendarEnd :size="20" />
				</template>
				<NcActionButton v-for="option in dueOptions"
					:key="String(option.days)"
					:close-after-click="true"
					@click="run('due', option.days)">
					<template #icon>
						<CalendarEnd :size="20" />
					</template>
					{{ option.label }}
				</NcActionButton>
			</NcActions>

			<NcActions v-if="calendars.length > 1"
				variant="tertiary"
				:menu-name="tbt('Move')"
				:disabled="busy">
				<template #icon>
					<FolderMoveOutline :size="20" />
				</template>
				<NcActionCaption :name="tbt('Move to list')" />
				<NcActionButton v-for="calendar in calendars"
					:key="calendar.id"
					:close-after-click="true"
					@click="run('move', calendar)">
					<template #icon>
						<span class="tb-menu-icon">
							<span class="tb-selection-bar__list" :style="{ 'background-color': calendar.color }" />
						</span>
					</template>
					{{ calendar.displayName }}
				</NcActionButton>
			</NcActions>
		</template>

		<NcButton variant="tertiary"
			:aria-label="tbt('End selection')"
			:title="tbt('End selection') + ' (Esc)'"
			@click="clear">
			<template #icon>
				<Close :size="20" />
			</template>
		</NcButton>

		<TbWaitDialog v-if="waitDialog"
			:task="waitTask"
			@confirm="confirmWait"
			@cancel="waitDialog = false" />
	</div>
</template>

<script>
import { tbt } from '../l10n.js'
import { sortKeyForRoute } from '../sort.js'
import { tagOptions } from '../taglist.js'
import { isWaitingTagName } from '../waiting.js'
import TbAvatar from './TbAvatar.vue'
import TbWaitDialog from './TbWaitDialog.vue'

import { showError, showSuccess } from '@nextcloud/dialogs'
import moment from '@nextcloud/moment'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCaption from '@nextcloud/vue/components/NcActionCaption'
import NcActionInput from '@nextcloud/vue/components/NcActionInput'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'
import NcButton from '@nextcloud/vue/components/NcButton'

import AccountOffOutline from 'vue-material-design-icons/AccountOffOutline.vue'
import AccountOutline from 'vue-material-design-icons/AccountOutline.vue'
import CalendarEnd from 'vue-material-design-icons/CalendarEnd.vue'
import CheckAll from 'vue-material-design-icons/CheckAll.vue'
import Close from 'vue-material-design-icons/Close.vue'
import FolderMoveOutline from 'vue-material-design-icons/FolderMoveOutline.vue'
import ListStatus from 'vue-material-design-icons/ListStatus.vue'
import Minus from 'vue-material-design-icons/Minus.vue'
import Plus from 'vue-material-design-icons/Plus.vue'
import Restore from 'vue-material-design-icons/Restore.vue'
import StarOutline from 'vue-material-design-icons/StarOutline.vue'
import TagPlusOutline from 'vue-material-design-icons/TagPlusOutline.vue'

export default {
	name: 'TbSelectionBar',
	components: {
		AccountOffOutline,
		AccountOutline,
		CalendarEnd,
		CheckAll,
		Close,
		FolderMoveOutline,
		ListStatus,
		Minus,
		NcActionButton,
		NcActionCaption,
		NcActionInput,
		NcActions,
		NcActionSeparator,
		NcButton,
		TbAvatar,
		TbWaitDialog,
		Plus,
		Restore,
		StarOutline,
		TagPlusOutline,
	},
	data() {
		return {
			busy: false,
			newTag: '',
			waitDialog: false,
			position: {},
		}
	},
	computed: {
		active() {
			return this.$store.getters.tbSelectionActive
		},
		count() {
			return this.$store.getters.tbSelectionCount
		},
		tasks() {
			return this.$store.getters.tbSelectedTasks
		},
		listKey() {
			return sortKeyForRoute(this.$route)
		},
		calendars() {
			return this.$store.getters.getSortedWritableCalendars
		},
		/** Persons with access to every list of the selection */
		people() {
			const ids = [...new Set(this.tasks.map(task => task.calendar.id))]
			if (!ids.length) {
				return []
			}
			const lists = ids.map(id => this.$store.getters.tbAssigneesFor(id))
			return lists[0].filter(person => lists.every(list => list.some(other => other.uid === person.uid)))
		},
		tagsInSelection() {
			return [...new Set(this.tasks.flatMap(task => task.tags))].sort((a, b) => a.localeCompare(b))
		},
		tagsToAdd() {
			// The fixed tag list first
			const all = tagOptions(this.$store.getters.tbTagList || [], this.$store.getters.tags || [])
			return all.filter(tag => !this.tasks.every(task => task.tags.includes(tag))).slice(0, 12)
		},
		tagsToRemove() {
			return this.tagsInSelection
		},
		columns() {
			return [
				{ id: 'open', label: tbt('Open') },
				{ id: 'inProgress', label: tbt('In progress') },
				{ id: 'waiting', label: tbt('Waiting') + ' …' },
				{ id: 'done', label: tbt('Done') },
				{ id: 'cancelled', label: tbt('Cancelled') },
			]
		},
		priorities() {
			return [
				{ value: 1, group: 'high', label: tbt('Important (1)') },
				{ value: 5, group: 'medium', label: tbt('Normal (5)') },
				{ value: 9, group: 'low', label: tbt('Someday (9)') },
				{ value: 0, group: 'none', label: tbt('No priority') },
			]
		},
		dueOptions() {
			return [
				{ days: 0, label: tbt('Today') },
				{ days: 1, label: tbt('Tomorrow') },
				{ days: 7, label: tbt('In a week') },
				{ days: null, label: tbt('No due date') },
			]
		},
		waitTask() {
			return { summary: tbt('{count} selected', { count: this.count }), startMoment: moment.invalid(), tags: [] }
		},
	},
	watch: {
		listKey() {
			this.$store.commit('clearTbSelection')
		},
		active(active) {
			if (active) {
				this.$nextTick(this.place)
			}
		},
	},
	mounted() {
		// Capture phase: Nextcloud handles Esc on the way up already
		window.addEventListener('keydown', this.onKeydown, true)
		window.addEventListener('resize', this.place)
		this.observer = new ResizeObserver(() => this.place())
		const content = document.querySelector('.app-content')
		if (content) {
			this.observer.observe(content)
		}
		this.place()
	},
	beforeUnmount() {
		window.removeEventListener('keydown', this.onKeydown, true)
		window.removeEventListener('resize', this.place)
		this.observer?.disconnect()
	},
	methods: {
		tbt,
		isWaitingTagName,
		/** Centered at the bottom of the list area (not under the sidebar) */
		place() {
			const content = document.querySelector('.app-content')
			if (!content) {
				return
			}
			const rect = content.getBoundingClientRect()
			this.position = { left: (rect.left + rect.width / 2) + 'px', maxWidth: Math.max(rect.width - 24, 280) + 'px' }
		},
		onKeydown($event) {
			if ($event.key !== 'Escape' || !this.active || this.waitDialog) {
				return
			}
			// Esc in a field, an open menu or a dialog belongs to them
			const focused = document.activeElement
			if (focused?.closest?.('input, textarea, [contenteditable=true], .v-popper__popper, .modal-mask, .tb-table-menu')
				|| document.querySelector('.modal-mask, [role=dialog][aria-modal=true], .v-popper__popper--shown')) {
				return
			}
			this.clear()
		},
		clear() {
			this.$store.commit('clearTbSelection')
		},
		loadPeople() {
			const seen = new Set()
			for (const task of this.tasks) {
				if (!seen.has(task.calendar.id)) {
					seen.add(task.calendar.id)
					this.$store.dispatch('loadTbAssignees', { calendar: task.calendar })
				}
			}
		},
		async run(action, value = null) {
			if (this.busy) {
				return
			}
			this.busy = true
			try {
				const changed = await this.$store.dispatch('tbBulk', { action, value })
				showSuccess(tbt('{count} tasks changed', { count: changed }))
			} catch (error) {
				console.error(error)
				showError(tbt('Not all tasks could be changed.'))
			} finally {
				this.busy = false
			}
		},
		setColumn(column) {
			if (column === 'waiting') {
				this.waitDialog = true
				return
			}
			this.run('column', { column })
		},
		confirmWait(date) {
			this.waitDialog = false
			this.run('column', { column: 'waiting', waitUntil: date })
		},
		addNewTag() {
			const tag = this.newTag.trim()
			if (tag) {
				this.newTag = ''
				this.run('addTag', tag)
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-selection-bar {
	position: fixed;
	bottom: 16px;
	width: max-content;
	transform: translateX(-50%);
	z-index: 1500;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	justify-content: center;
	gap: 2px;
	padding: 4px 6px 4px 14px;
	border-radius: 14px;
	background-color: var(--color-main-background);
	border: 1px solid var(--color-border-dark);
	box-shadow: 0 8px 24px rgba(0, 0, 0, .18), 0 2px 6px rgba(0, 0, 0, .08);

	&__count {
		font-weight: 600;
		font-size: 13px;
		margin-right: 6px;
		white-space: nowrap;
	}

	&__dot,
	&__list {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background-color: var(--tb-status-open, #8a94a6);

		&--inProgress {
			background-color: var(--tb-status-progress, #3d7bd9);
		}

		&--waiting {
			background-color: var(--tb-status-waiting, #e09b13);
		}

		&--done {
			background-color: var(--tb-status-done, #2e9e5b);
		}

		&--cancelled {
			background-color: var(--tb-status-cancelled, #9aa0a6);
		}
	}

	&__prio--high {
		color: var(--tb-prio-high, #d1453b);
	}

	&__prio--medium {
		color: var(--tb-prio-medium, #e09b13);
	}

	&__prio--low {
		color: var(--tb-prio-low, #3d7bd9);
	}

	@media only screen and (max-width: 700px) {
		bottom: 8px;
		padding-left: 10px;

		:deep(.button-vue__text) {
			display: none;
		}
	}
}
</style>
