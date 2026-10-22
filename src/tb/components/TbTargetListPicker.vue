<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Header: the list new tasks are added to (next to the input).
-->
<template>
	<NcActions v-if="target && calendars.length > 1"
		class="tb-target"
		variant="tertiary"
		:menu-name="target.displayName"
		:aria-label="tbt('List for new tasks: {list}', { list: target.displayName })"
		:title="tbt('List for new tasks: {list}', { list: target.displayName })">
		<template #icon>
			<span class="tb-target__dot" :style="{ 'background-color': target.color }" />
		</template>
		<NcActionCaption :name="tbt('Add new tasks to')" />
		<NcActionButton v-for="calendar in calendars"
			:key="calendar.id"
			type="radio"
			:value="calendar.id"
			:model-value="target.id"
			:close-after-click="true"
			@click="choose(calendar)">
			<template #icon>
				<span class="tb-menu-icon">
					<span class="tb-target__dot tb-target__dot--menu" :style="{ 'background-color': calendar.color }" />
				</span>
			</template>
			{{ calendar.displayName }}
		</NcActionButton>
	</NcActions>
</template>

<script>
import { tbt } from '../l10n.js'

import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionCaption from '@nextcloud/vue/components/NcActionCaption'
import NcActions from '@nextcloud/vue/components/NcActions'

export default {
	name: 'TbTargetListPicker',
	components: {
		NcActionButton,
		NcActionCaption,
		NcActions,
	},
	emits: ['chosen'],
	computed: {
		target() {
			return this.$store.getters.tbTargetCalendar(this.$route)
		},
		calendars() {
			// The template list only when it is shown
			const templateId = this.$store.getters.tbTemplateCalendar?.id
			return this.$store.getters.getSortedWritableCalendars
				.filter(calendar => calendar.supportsTasks !== false)
				.filter(calendar => calendar.id !== templateId || calendar.id === this.$route.params.calendarId)
		},
	},
	methods: {
		tbt,
		async choose(calendar) {
			await this.$store.dispatch('setTbTargetCalendar', { route: this.$route, calendarId: calendar.id })
			this.$emit('chosen', calendar)
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-target {
	flex: 0 0 auto;
	min-width: 0;
	max-width: 180px;
	overflow: hidden;

	:deep(.button-vue) {
		max-width: 100%;
		min-height: 36px;
		border-radius: var(--tb-radius, 10px);
		font-weight: 500;
		font-size: 13px;

		.button-vue__wrapper {
			min-width: 0;
			max-width: 100%;
			overflow: hidden;
		}

		.button-vue__text {
			min-width: 0;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}
	}

	&__dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 50%;

		&--menu {
			width: 12px;
			height: 12px;
		}
	}

	// Narrow screens: only the colour dot
	@media only screen and (max-width: 700px) {
		max-width: 44px;

		:deep(.button-vue__text) {
			display: none;
		}
	}
}
</style>
