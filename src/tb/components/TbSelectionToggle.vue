<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Header button: selection mode (a click selects instead of opening).
With a mouse Ctrl/Cmd+click and Shift+click work without it.
-->
<template>
	<NcButton class="tb-selection-toggle"
		variant="tertiary"
		:pressed="active"
		:aria-label="tbt('Select several tasks')"
		:title="tbt('Select several tasks (also Ctrl/Cmd+click, Shift+click)')"
		@click="toggle">
		<template #icon>
			<CheckboxMultipleMarkedOutline :size="20" />
		</template>
	</NcButton>
</template>

<script>
import { tbt } from '../l10n.js'

import NcButton from '@nextcloud/vue/components/NcButton'

import CheckboxMultipleMarkedOutline from 'vue-material-design-icons/CheckboxMultipleMarkedOutline.vue'

export default {
	name: 'TbSelectionToggle',
	components: {
		CheckboxMultipleMarkedOutline,
		NcButton,
	},
	computed: {
		active() {
			return this.$store.getters.tbSelectionActive
		},
	},
	methods: {
		tbt,
		toggle() {
			this.$store.commit('setTbSelectionMode', !this.active)
		},
	},
}
</script>
