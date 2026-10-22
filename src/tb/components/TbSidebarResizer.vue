<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Drag handle at the left edge of the sidebar: makes the sidebar wider or narrower.
The width is remembered per browser, a double click restores the default.
Dragged clearly below the smallest width, the sidebar closes.
-->
<template>
	<Teleport defer to="#app-sidebar-vue">
		<div class="tb-sidebar-resizer"
			:class="{ 'tb-sidebar-resizer--active': dragging, 'tb-sidebar-resizer--collapse': collapsing }"
			role="separator"
			aria-orientation="vertical"
			:aria-label="tbt('Change the width of the sidebar')"
			:title="tbt('Drag to change the width, drag it very narrow to close, double click for the default width')"
			tabindex="0"
			@pointerdown="start"
			@dblclick="reset"
			@keydown.left.prevent="nudge(20)"
			@keydown.right.prevent="nudge(-20)" />
	</Teleport>
</template>

<script>
import { tbt } from '../l10n.js'
import { resolveDrag, storedWidth, storeWidth } from '../resize.js'

const STORAGE_KEY = 'tasks_board.sidebarWidth'
const MIN_WIDTH = 300
/** Dragged narrower than this, the sidebar closes */
const COLLAPSE_BELOW = 200
/** Space that always stays for the list */
const MIN_CONTENT = 360
/** Below this window width the sidebar covers the screen anyway */
const MOBILE = 512

export default {
	name: 'TbSidebarResizer',
	data() {
		return {
			dragging: false,
			collapsing: false,
		}
	},
	mounted() {
		window.addEventListener('resize', this.applyStored)
		this.$nextTick(this.applyStored)
	},
	beforeUnmount() {
		window.removeEventListener('resize', this.applyStored)
		this.stop()
	},
	methods: {
		tbt,
		sidebar() {
			return document.getElementById('app-sidebar-vue')
		},
		limits() {
			return { min: MIN_WIDTH, max: window.innerWidth - MIN_CONTENT, collapseBelow: COLLAPSE_BELOW }
		},
		clamp(width) {
			return resolveDrag(width, this.limits()).width
		},
		apply(width) {
			const sidebar = this.sidebar()
			if (!sidebar) {
				return
			}
			if (width === null || window.innerWidth <= MOBILE) {
				sidebar.style.removeProperty('--app-sidebar-width')
				return
			}
			sidebar.style.setProperty('--app-sidebar-width', this.clamp(width) + 'px')
		},
		applyStored() {
			this.apply(storedWidth(STORAGE_KEY))
		},
		save(width) {
			storeWidth(STORAGE_KEY, width === null ? null : this.clamp(width))
		},
		start($event) {
			if (window.innerWidth <= MOBILE || $event.button !== 0) {
				return
			}
			$event.preventDefault()
			this.dragging = true
			document.body.classList.add('tb-resizing')
			window.addEventListener('pointermove', this.move)
			window.addEventListener('pointerup', this.end)
		},
		move($event) {
			const sidebar = this.sidebar()
			if (!sidebar) {
				return
			}
			const right = sidebar.getBoundingClientRect().right
			const drag = resolveDrag(right - $event.clientX, this.limits())
			this.apply(drag.width)
			this.setCollapsing(drag.collapse)
		},
		end() {
			const sidebar = this.sidebar()
			const collapse = this.collapsing
			if (sidebar && !collapse) {
				this.save(sidebar.getBoundingClientRect().width)
			}
			this.stop()
			if (collapse) {
				// Keep the last width for the next time, close the sidebar like its ✕ does
				this.applyStored()
				sidebar?.querySelector('.app-sidebar__close')?.click()
			}
		},
		setCollapsing(collapsing) {
			this.collapsing = collapsing
			this.sidebar()?.classList.toggle('tb-collapsing', collapsing)
		},
		stop() {
			this.dragging = false
			this.setCollapsing(false)
			document.body.classList.remove('tb-resizing')
			window.removeEventListener('pointermove', this.move)
			window.removeEventListener('pointerup', this.end)
		},
		nudge(delta) {
			const sidebar = this.sidebar()
			if (!sidebar) {
				return
			}
			const width = this.clamp(sidebar.getBoundingClientRect().width + delta)
			this.apply(width)
			this.save(width)
		},
		reset() {
			this.save(null)
			this.apply(null)
		},
	},
}
</script>

<style lang="scss">
// Global: the handle is teleported into the sidebar
#app-sidebar-vue {
	.tb-sidebar-resizer {
		position: absolute;
		inset-block: 0;
		inset-inline-start: -4px;
		width: 9px;
		z-index: 2000;
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

		@media only screen and (max-width: 512px) {
			display: none;
		}
	}
}

// While dragging: no text selection, no width animation
body.tb-resizing {
	cursor: col-resize;
	user-select: none;

	#app-sidebar-vue {
		transition: none !important;
	}
}

// Letting go now closes the sidebar
#app-sidebar-vue.tb-collapsing {
	opacity: .55;
}
</style>
