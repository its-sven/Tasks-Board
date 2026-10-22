<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Small menu for a table cell (status, priority, person). One menu for the whole
table instead of one per cell, so large tables stay fast.
-->
<template>
	<Teleport to="body">
		<div ref="menu"
			class="tb-table-menu"
			role="menu"
			:aria-label="title"
			:style="position"
			@keydown="onKeydown">
			<div v-if="title" class="tb-table-menu__title">
				{{ title }}
			</div>
			<div v-if="loading" class="tb-table-menu__hint">
				{{ tbt('Loading …') }}
			</div>
			<button v-for="(item, index) in items"
				:key="item.value"
				ref="items"
				type="button"
				role="menuitemradio"
				:aria-checked="item.checked ? 'true' : 'false'"
				class="tb-table-menu__item"
				:class="{ 'tb-table-menu__item--checked': item.checked }"
				:tabindex="index === focusIndex ? 0 : -1"
				@click="select(item)">
				<span class="tb-table-menu__icon">
					<TbAvatar v-if="item.person" :person="item.person" :size="22" />
					<span v-else-if="item.color" class="tb-table-menu__dot" :style="{ 'background-color': item.color }" />
					<component :is="item.icon" v-else-if="item.icon" :size="18" />
				</span>
				<span class="tb-table-menu__label">{{ item.label }}</span>
				<Check v-if="item.checked" :size="16" class="tb-table-menu__check" />
			</button>
			<slot />
		</div>
	</Teleport>
</template>

<script>
import { tbt } from '../l10n.js'
import TbAvatar from './TbAvatar.vue'

import Check from 'vue-material-design-icons/Check.vue'

export default {
	name: 'TbTableMenu',
	components: {
		Check,
		TbAvatar,
	},
	props: {
		/** The element the menu belongs to */
		anchor: {
			type: Object,
			required: true,
		},
		items: {
			type: Array,
			required: true,
		},
		title: {
			type: String,
			default: '',
		},
		loading: {
			type: Boolean,
			default: false,
		},
	},
	emits: ['select', 'close'],
	data() {
		return {
			position: { top: '0px', left: '0px', visibility: 'hidden' },
			focusIndex: 0,
		}
	},
	watch: {
		items() {
			this.$nextTick(this.place)
		},
	},
	mounted() {
		const checked = this.items.findIndex(item => item.checked)
		this.focusIndex = checked > -1 ? checked : 0
		this.$nextTick(() => {
			this.place()
			this.focus()
		})
		document.addEventListener('pointerdown', this.onOutside, true)
		window.addEventListener('resize', this.close)
		document.addEventListener('scroll', this.onScroll, true)
	},
	beforeUnmount() {
		document.removeEventListener('pointerdown', this.onOutside, true)
		window.removeEventListener('resize', this.close)
		document.removeEventListener('scroll', this.onScroll, true)
	},
	methods: {
		tbt,
		place() {
			const menu = this.$refs.menu
			if (!menu || !this.anchor?.getBoundingClientRect) {
				return
			}
			const rect = this.anchor.getBoundingClientRect()
			const width = menu.offsetWidth
			const height = menu.offsetHeight
			const below = window.innerHeight - rect.bottom
			const top = below >= height + 8 || below > rect.top ? rect.bottom + 4 : rect.top - height - 4
			const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
			this.position = { top: Math.max(8, top) + 'px', left: left + 'px', visibility: 'visible' }
		},
		focus() {
			this.$refs.items?.[this.focusIndex]?.focus()
		},
		select(item) {
			this.$emit('select', item.value)
		},
		close() {
			this.$emit('close')
		},
		onOutside(event) {
			if (!this.$refs.menu?.contains(event.target) && !this.anchor?.contains?.(event.target)) {
				this.close()
			}
		},
		onScroll(event) {
			if (!this.$refs.menu?.contains(event.target)) {
				this.close()
			}
		},
		onKeydown(event) {
			const count = this.items.length
			switch (event.key) {
			case 'Escape':
			case 'Tab':
				event.preventDefault()
				event.stopPropagation()
				this.close()
				this.anchor?.focus?.()
				break
			case 'ArrowDown':
				event.preventDefault()
				this.focusIndex = (this.focusIndex + 1) % count
				this.focus()
				break
			case 'ArrowUp':
				event.preventDefault()
				this.focusIndex = (this.focusIndex - 1 + count) % count
				this.focus()
				break
			case 'Home':
				event.preventDefault()
				this.focusIndex = 0
				this.focus()
				break
			case 'End':
				event.preventDefault()
				this.focusIndex = count - 1
				this.focus()
				break
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-table-menu {
	position: fixed;
	z-index: 10010;
	min-width: 190px;
	max-width: 320px;
	max-height: min(360px, calc(100vh - 24px));
	overflow-y: auto;
	padding: 4px;
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-large, 12px);
	background-color: var(--color-main-background);
	box-shadow: 0 4px 20px rgba(0, 0, 0, .18);

	&__title {
		padding: 6px 10px 4px;
		color: var(--color-text-maxcontrast);
		font-size: 12px;
		font-weight: 600;
	}

	&__hint {
		padding: 6px 10px;
		color: var(--color-text-maxcontrast);
	}

	&__item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 36px;
		margin: 0;
		padding: 2px 10px 2px 4px;
		border: none;
		border-radius: var(--border-radius, 8px);
		background: transparent;
		color: var(--color-main-text);
		font-weight: normal;
		text-align: start;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			background-color: var(--color-background-hover);
			outline: none;
		}

		&--checked {
			font-weight: 600;
		}
	}

	&__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 28px;
		height: 28px;
	}

	&__dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}

	&__label {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__check {
		flex: 0 0 auto;
		color: var(--color-primary-element);
	}
}
</style>
