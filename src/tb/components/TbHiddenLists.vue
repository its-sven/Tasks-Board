<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
The hidden lists, folded at the bottom of the navigation. Opens by itself
when one of them is shown and then stays open. Each list keeps its menu
("Show list").
-->
<template>
	<NcAppNavigationItem v-if="calendars.length"
		:name="tbt('Hidden lists')"
		class="collection reactive tb-hidden-lists"
		:allow-collapse="true"
		:open="open"
		@update:open="toggled = $event"
		@click.prevent="toggled = !open">
		<template #icon>
			<EyeOffOutline :size="20" />
		</template>
		<template #counter>
			<NcCounterBubble :count="calendars.length" />
		</template>
		<ListItemCalendar v-for="calendar in calendars"
			:key="calendar.id"
			:calendar="calendar" />
	</NcAppNavigationItem>
</template>

<script>
import ListItemCalendar from '../../components/AppNavigation/ListItemCalendar.vue'
import { tbt } from '../l10n.js'

import NcAppNavigationItem from '@nextcloud/vue/components/NcAppNavigationItem'
import NcCounterBubble from '@nextcloud/vue/components/NcCounterBubble'

import EyeOffOutline from 'vue-material-design-icons/EyeOffOutline.vue'

export default {
	name: 'TbHiddenLists',
	components: {
		EyeOffOutline,
		ListItemCalendar,
		NcAppNavigationItem,
		NcCounterBubble,
	},
	data() {
		return {
			// Opened or closed (null: closed until a hidden list is shown)
			toggled: null,
		}
	},
	computed: {
		calendars() {
			return this.$store.getters.tbHiddenCalendars
		},
		showsHiddenList() {
			return this.calendars.some(calendar => calendar.id === this.$route.params.calendarId)
		},
		open() {
			return this.toggled ?? this.showsHiddenList
		},
	},
	watch: {
		// Open while a hidden list is shown, and stay open afterwards
		showsHiddenList: {
			handler(shows) {
				if (shows) {
					this.toggled = true
				}
			},
			immediate: true,
		},
	},
	methods: {
		tbt,
	},
}
</script>
