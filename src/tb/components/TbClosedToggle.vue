<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Header button: show or hide completed and cancelled tasks.
Applies to list, board and table and is stored per person.
When switched on, the completed tasks of the shown lists are loaded.
-->
<template>
	<NcButton v-if="visible"
		class="tb-closed-toggle"
		variant="tertiary"
		:pressed="showClosed"
		:aria-label="tbt('Show completed and cancelled tasks')"
		:title="tbt('Show completed and cancelled tasks')"
		@click="toggle">
		<template #icon>
			<NcLoadingIcon v-if="loading" :size="20" />
			<EyeCheckOutline v-else :size="20" />
		</template>
	</NcButton>
</template>

<script>
import { viewKeyForRoute } from '../board.js'
import { loadCompletedTasks } from '../closed.js'
import { tbt } from '../l10n.js'

import { showError } from '@nextcloud/dialogs'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcLoadingIcon from '@nextcloud/vue/components/NcLoadingIcon'

import EyeCheckOutline from 'vue-material-design-icons/EyeCheckOutline.vue'

export default {
	name: 'TbClosedToggle',
	components: {
		EyeCheckOutline,
		NcButton,
		NcLoadingIcon,
	},
	data() {
		return {
			loading: false,
		}
	},
	computed: {
		showClosed() {
			return this.$store.getters.tbShowClosed
		},
		viewKey() {
			return viewKeyForRoute(this.$route)
		},
		/**
		 * Lists always show completed tasks on request, collections only as board or table
		 *
		 * @return {boolean}
		 */
		visible() {
			if (!this.viewKey) {
				return false
			}
			return !!this.$route.params.calendarId || this.$store.getters.tbView(this.viewKey).mode !== 'list'
		},
		calendars() {
			if (this.$route.params.calendarId) {
				const calendar = this.$store.getters.getCalendarByRoute(this.$route)
				return calendar ? [calendar] : []
			}
			return this.$store.getters.getSortedCalendars
		},
		missing() {
			if (!this.visible || !this.showClosed) {
				return ''
			}
			return this.calendars.filter(calendar => !calendar.loadedCompleted).map(calendar => calendar.id).join('\n')
		},
	},
	watch: {
		missing: {
			handler(missing) {
				if (missing) {
					this.load()
				}
			},
			immediate: true,
		},
	},
	methods: {
		tbt,
		toggle() {
			this.$store.dispatch('setTbShowClosed', !this.showClosed)
		},
		async load() {
			this.loading = true
			try {
				await loadCompletedTasks(this.$store, this.calendars)
			} catch (error) {
				console.error(error)
				showError(tbt('Could not load the completed tasks.'))
			} finally {
				this.loading = false
			}
		},
	},
}
</script>
