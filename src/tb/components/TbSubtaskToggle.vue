<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Arrow in front of a list row: opens or closes its subtasks.
-->
<template>
	<button type="button"
		class="tb-subtask-toggle no-nav"
		:class="{ 'tb-subtask-toggle--open': expanded }"
		:aria-expanded="expanded ? 'true' : 'false'"
		:aria-label="expanded ? tbt('Hide subtasks') : tbt('Show subtasks')"
		:title="(expanded ? tbt('Hide subtasks') : tbt('Show subtasks')) + ' (' + count + ')'"
		@click.stop="$emit('toggle')">
		<ChevronRight :size="18" />
	</button>
</template>

<script>
import { tbt } from '../l10n.js'

import ChevronRight from 'vue-material-design-icons/ChevronRight.vue'

export default {
	name: 'TbSubtaskToggle',
	components: {
		ChevronRight,
	},
	props: {
		expanded: {
			type: Boolean,
			default: true,
		},
		count: {
			type: Number,
			default: 0,
		},
	},
	emits: ['toggle'],
	methods: {
		tbt,
	},
}
</script>

<style lang="scss" scoped>
.tb-subtask-toggle {
	position: absolute;
	inset-inline-start: 0;
	top: 50%;
	transform: translateY(-50%);
	display: flex;
	align-items: center;
	justify-content: center;
	width: 22px;
	height: 26px;
	min-height: 0;
	margin: 0;
	padding: 0;
	border: none;
	border-radius: 6px;
	background: transparent;
	color: var(--color-text-maxcontrast);
	cursor: pointer;

	&:hover,
	&:focus-visible {
		background-color: var(--color-background-hover);
		color: var(--color-main-text);
	}

	:deep(.material-design-icon) {
		transition: transform 120ms ease;
	}

	&--open :deep(.material-design-icon) {
		transform: rotate(90deg);
	}
}
</style>
