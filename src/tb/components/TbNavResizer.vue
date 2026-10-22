<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Drag handle at the right edge of the navigation (lists and collections): makes
it wider or narrower. Dragged clearly below the smallest width, the navigation
closes (the ☰ button opens it again with the last width). Double click: default.
-->
<template>
	<div class="tb-nav-resizer"
		:class="{ 'tb-nav-resizer--active': dragging, 'tb-nav-resizer--collapse': collapsing }"
		role="separator"
		aria-orientation="vertical"
		:aria-label="tbt('Change the width of the navigation')"
		:title="tbt('Drag to change the width, drag it very narrow to close, double click for the default width')"
		tabindex="0"
		@pointerdown="start"
		@dblclick="reset"
		@keydown.left.prevent="nudge(-20)"
		@keydown.right.prevent="nudge(20)" />
</template>

<script>
import { tbt } from '../l10n.js'
import { resolveDrag, storedWidth, storeWidth } from '../resize.js'

import { emit } from '@nextcloud/event-bus'

const STORAGE_KEY = 'tasks_board.navigationWidth'
const VARIABLE = '--tb-navigation-width'
const MIN_WIDTH = 200
const MAX_WIDTH = 520
/** Dragged narrower than this, the navigation closes */
const COLLAPSE_BELOW = 130
/** Space that always stays for the list */
const MIN_CONTENT = 560
/** Below this window width the navigation lies over the content and keeps its width */
const DESKTOP = 1024

export default {
	name: 'TbNavResizer',
	data() {
		return {
			dragging: false,
			collapsing: false,
		}
	},
	mounted() {
		window.addEventListener('resize', this.applyStored)
		this.applyStored()
	},
	beforeUnmount() {
		window.removeEventListener('resize', this.applyStored)
		this.stop()
	},
	methods: {
		tbt,
		navigation() {
			return this.$el?.closest?.('.app-navigation') || document.querySelector('.app-navigation')
		},
		limits() {
			return { min: MIN_WIDTH, max: Math.min(MAX_WIDTH, window.innerWidth - MIN_CONTENT), collapseBelow: COLLAPSE_BELOW }
		},
		clamp(width) {
			return resolveDrag(width, this.limits()).width
		},
		apply(width) {
			if (width === null || window.innerWidth < DESKTOP) {
				document.body.style.removeProperty(VARIABLE)
				return
			}
			document.body.style.setProperty(VARIABLE, this.clamp(width) + 'px')
		},
		applyStored() {
			this.apply(storedWidth(STORAGE_KEY))
		},
		start($event) {
			if (window.innerWidth < DESKTOP || $event.button !== 0) {
				return
			}
			$event.preventDefault()
			this.dragging = true
			document.body.classList.add('tb-resizing')
			window.addEventListener('pointermove', this.move)
			window.addEventListener('pointerup', this.end)
		},
		move($event) {
			const navigation = this.navigation()
			if (!navigation) {
				return
			}
			const drag = resolveDrag($event.clientX - navigation.getBoundingClientRect().left, this.limits())
			this.apply(drag.width)
			this.setCollapsing(drag.collapse)
		},
		end() {
			const navigation = this.navigation()
			const collapse = this.collapsing
			if (navigation && !collapse) {
				storeWidth(STORAGE_KEY, this.clamp(navigation.getBoundingClientRect().width))
			}
			this.stop()
			if (collapse) {
				// Keep the last width for reopening
				this.applyStored()
				emit('toggle-navigation', { open: false })
			}
		},
		setCollapsing(collapsing) {
			this.collapsing = collapsing
			this.navigation()?.classList.toggle('tb-collapsing', collapsing)
		},
		stop() {
			this.dragging = false
			this.setCollapsing(false)
			document.body.classList.remove('tb-resizing')
			window.removeEventListener('pointermove', this.move)
			window.removeEventListener('pointerup', this.end)
		},
		nudge(delta) {
			const navigation = this.navigation()
			if (!navigation || window.innerWidth < DESKTOP) {
				return
			}
			const width = this.clamp(navigation.getBoundingClientRect().width + delta)
			this.apply(width)
			storeWidth(STORAGE_KEY, width)
		},
		reset() {
			storeWidth(STORAGE_KEY, null)
			this.apply(null)
		},
	},
}
</script>

<style lang="scss">
// Global: the width also applies to the navigation itself (scoped styles of Nextcloud)
@media only screen and (min-width: 1024px) {
	.app-tasks_board .app-navigation.app-navigation {
		width: var(--tb-navigation-width, 300px);

		&.app-navigation--closed {
			margin-inline-start: calc(-1 * min(var(--tb-navigation-width, 300px), var(--app-navigation-max-width)));
		}
	}
}

.app-tasks_board .app-navigation {
	.tb-nav-resizer {
		position: absolute;
		inset-block: 0;
		inset-inline-end: -5px;
		width: 9px;
		z-index: 10;
		cursor: col-resize;
		touch-action: none;

		&::after {
			content: '';
			position: absolute;
			inset-block: 0;
			inset-inline-start: 4px;
			width: 1px;
			background-color: transparent;
			transition: background-color 120ms ease, width 120ms ease;
		}

		&:hover::after,
		&:focus-visible::after,
		&--active::after {
			width: 3px;
			inset-inline-start: 3px;
			background-color: var(--color-primary-element);
		}

		&--collapse::after,
		&--collapse:hover::after {
			background-color: var(--color-element-error, var(--color-error));
		}

		&:focus-visible {
			outline: none;
		}

		@media only screen and (max-width: 1023px) {
			display: none;
		}
	}

	// Letting go now closes the navigation
	&.tb-collapsing {
		opacity: .55;
	}
}

body.tb-resizing .app-tasks_board .app-navigation {
	transition: none !important;
}
</style>
