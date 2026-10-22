<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Switch between list, board and table in the header (segmented control).
The choice applies to all lists and collections.
-->
<template>
	<div v-if="viewKey"
		class="tb-switch"
		role="group"
		:aria-label="tbt('View')">
		<button v-for="option in options"
			:key="option.mode"
			type="button"
			class="tb-switch__option"
			:class="['tb-switch__option--' + option.mode, { 'tb-switch__option--active': mode === option.mode }]"
			:aria-pressed="mode === option.mode ? 'true' : 'false'"
			:title="option.label"
			@click="set(option.mode)">
			<component :is="option.icon" :size="18" />
			<span class="tb-switch__label">{{ option.label }}</span>
		</button>
	</div>
</template>

<script>
import { viewKeyForRoute } from '../board.js'
import { tbt } from '../l10n.js'

import TableLarge from 'vue-material-design-icons/TableLarge.vue'
import ViewColumnOutline from 'vue-material-design-icons/ViewColumnOutline.vue'
import ViewListOutline from 'vue-material-design-icons/ViewListOutline.vue'

export default {
	name: 'TbViewSwitch',
	components: {
		TableLarge,
		ViewColumnOutline,
		ViewListOutline,
	},
	computed: {
		viewKey() {
			return viewKeyForRoute(this.$route)
		},
		mode() {
			return this.$store.getters.tbView(this.viewKey).mode
		},
		options() {
			return [
				{ mode: 'list', label: tbt('List'), icon: 'ViewListOutline' },
				{ mode: 'board', label: tbt('Board'), icon: 'ViewColumnOutline' },
				{ mode: 'table', label: tbt('Table'), icon: 'TableLarge' },
			]
		},
	},
	methods: {
		tbt,
		set(mode) {
			if (mode !== this.mode) {
				this.$store.dispatch('setTbView', { key: this.viewKey, patch: { mode } })
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-switch {
	display: inline-flex;
	flex-shrink: 0;
	align-items: center;
	gap: 2px;
	height: 36px;
	padding: 2px;
	border-radius: var(--tb-radius, 10px);
	background-color: var(--color-background-dark);

	&__option {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 32px;
		min-height: 0;
		margin: 0;
		padding: 0 12px;
		border: none;
		border-radius: calc(var(--tb-radius, 10px) - 2px);
		background: transparent;
		color: var(--color-text-maxcontrast);
		font: inherit;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 120ms ease, color 120ms ease, box-shadow 120ms ease;

		&:hover {
			color: var(--color-main-text);
			background-color: transparent;
		}

		&:focus-visible {
			outline: 2px solid var(--color-primary-element);
			outline-offset: 1px;
		}

		&--active,
		&--active:hover {
			color: var(--color-main-text);
			background-color: var(--color-main-background);
			box-shadow: 0 1px 2px rgba(0, 0, 0, .12), 0 0 0 1px rgba(0, 0, 0, .04);
		}
	}

	// Narrow screens: icons only
	@media only screen and (max-width: 700px) {
		&__option {
			padding: 0 8px;
		}

		&__label {
			display: none;
		}
	}
}
</style>
