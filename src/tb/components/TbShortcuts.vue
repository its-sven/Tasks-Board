<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Keyboard shortcuts for lists and boards, "?" shows the overview.
-->
<template>
	<NcDialog v-if="helpOpen"
		:name="tbt('Keyboard shortcuts')"
		:open="true"
		size="small"
		class="tb-shortcuts"
		@update:open="helpOpen = $event">
		<table class="tb-shortcuts__table">
			<tbody>
				<tr v-for="entry in shortcuts" :key="entry.label">
					<td class="tb-shortcuts__keys">
						<template v-for="(key, index) in entry.keys" :key="key">
							<span v-if="index" class="tb-shortcuts__or">{{ tbt('or') }}</span>
							<kbd>{{ keyLabel(key) }}</kbd>
						</template>
					</td>
					<td>{{ tbt(entry.label) }}</td>
				</tr>
			</tbody>
		</table>
		<p class="tb-shortcuts__hint">
			{{ tbt('Shortcuts do not apply while you type in a field or a menu is open.') }}
		</p>
	</NcDialog>
</template>

<script>
import { viewKeyForRoute } from '../board.js'
import { tbt } from '../l10n.js'
import { moveIndex, nextViewMode, shortcutAction, shortcutsBlocked, SHORTCUTS, TASK_SELECTOR } from '../shortcuts.js'
import { isTaskReadOnly } from '../store/board.js'

import { subscribe, unsubscribe } from '@nextcloud/event-bus'
import NcDialog from '@nextcloud/vue/components/NcDialog'

export default {
	name: 'TbShortcuts',
	components: {
		NcDialog,
	},
	data() {
		return {
			helpOpen: false,
			shortcuts: SHORTCUTS,
		}
	},
	mounted() {
		window.addEventListener('keydown', this.onKeydown)
		subscribe('tasks_board:show-shortcuts', this.showHelp)
	},
	beforeUnmount() {
		window.removeEventListener('keydown', this.onKeydown)
		unsubscribe('tasks_board:show-shortcuts', this.showHelp)
	},
	methods: {
		tbt,
		keyLabel(key) {
			return { Space: tbt('Space'), Enter: tbt('Enter') }[key] || key
		},
		showHelp() {
			this.helpOpen = true
		},
		/** Task rows and cards that are visible, in page order */
		items() {
			return [...document.querySelectorAll('.app-content ' + TASK_SELECTOR.split(', ').join(', .app-content '))]
				.filter(element => element.offsetParent !== null || element.tagName === 'TR')
		},
		findTask(key) {
			for (const calendar of this.$store.getters.getSortedCalendars) {
				for (const task of Object.values(calendar.tasks)) {
					if (task.key === key) {
						return task
					}
				}
			}
			return null
		},
		focusItem(element) {
			if (!element) {
				return
			}
			if (!element.hasAttribute('tabindex')) {
				element.setAttribute('tabindex', '-1')
			}
			element.focus()
			element.scrollIntoView({ block: 'nearest' })
		},
		/**
		 * Focuses the task again after the list was updated (or the one at its place)
		 *
		 * @param {string} key Key of the task
		 * @param {number} index Its position before
		 */
		refocus(key, index) {
			setTimeout(() => {
				const items = this.items()
				const same = items.find(element => element.dataset.taskKey === key)
				this.focusItem(same || items[Math.min(index, items.length - 1)])
			}, 150)
		},
		onKeydown(event) {
			if (this.helpOpen || shortcutsBlocked(event)) {
				return
			}
			const item = event.target?.closest?.(TASK_SELECTOR) || null
			const onTask = !!item && event.target === item
			const action = shortcutAction(event, { onTask })
			if (!action) {
				return
			}
			// Arrow keys only move between tasks when no other element has the focus
			const free = onTask || event.target === document.body || event.target === document.documentElement
			if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && !free) {
				return
			}
			switch (action) {
			case 'newTask': {
				const input = document.querySelector('.header__input input')
				if (input) {
					event.preventDefault()
					input.focus()
				}
				break
			}
			case 'next':
			case 'previous': {
				const items = this.items()
				if (!items.length) {
					return
				}
				const current = item && onTask
					? item
					: items.find(element => element.matches('.task-item__body--active, .tb-card--active, .tb-table__row--active')) || null
				const index = moveIndex(current ? items.indexOf(current) : -1, items.length, action === 'next' ? 1 : -1)
				event.preventDefault()
				this.focusItem(items[index])
				break
			}
			case 'open':
				// Board cards open themselves on Enter
				if (!item.classList.contains('tb-card')) {
					event.preventDefault()
					item.click()
				}
				break
			case 'toggle': {
				event.preventDefault()
				const task = this.findTask(item.dataset.taskKey)
				if (task && !isTaskReadOnly(task)) {
					const index = this.items().indexOf(item)
					this.$store.dispatch('toggleCompleted', task)
					this.refocus(task.key, index)
				}
				break
			}
			case 'select':
				event.preventDefault()
				this.$store.commit('toggleTbSelected', item.dataset.taskKey)
				break
			case 'board': {
				const key = viewKeyForRoute(this.$route)
				if (key) {
					event.preventDefault()
					const mode = nextViewMode(this.$store.getters.tbView(key).mode)
					this.$store.dispatch('setTbView', { key, patch: { mode } })
				}
				break
			}
			case 'help':
				event.preventDefault()
				this.helpOpen = true
				break
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-shortcuts {
	&__table {
		width: 100%;
		border-collapse: collapse;

		td {
			padding: 6px 4px;
			border-bottom: 1px solid var(--color-border);
			vertical-align: middle;
		}

		tr:last-child td {
			border-bottom: none;
		}
	}

	&__keys {
		width: 1%;
		white-space: nowrap;
		padding-inline-end: 16px !important;
	}

	&__or {
		margin: 0 4px;
		color: var(--color-text-maxcontrast);
		font-size: 12px;
	}

	kbd {
		display: inline-block;
		min-width: 24px;
		padding: 2px 6px;
		border: 1px solid var(--color-border-dark);
		border-bottom-width: 2px;
		border-radius: 6px;
		background: var(--color-background-hover);
		font-family: inherit;
		font-size: 12px;
		font-weight: 600;
		text-align: center;
	}

	&__hint {
		margin-top: calc(2 * var(--default-grid-baseline));
		color: var(--color-text-maxcontrast);
		font-size: 13px;
	}
}
</style>
