<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Badge for a waiting task whose follow-up is due (list rows).
Opens a small menu: stop waiting or set a new follow-up date.
-->
<template>
	<NcActions v-if="state"
		class="tb-followup"
		:class="{ 'tb-followup--due': due }"
		variant="tertiary"
		:menu-name="label"
		:aria-label="title"
		:title="title"
		:disabled="readOnly">
		<template #icon>
			<BellAlertOutline v-if="due" :size="16" />
			<TimerSandEmpty v-else :size="16" />
		</template>
		<NcActionButton :close-after-click="true" @click="stop">
			<template #icon>
				<CheckIcon :size="20" />
			</template>
			{{ tbt('Stop waiting') }}
		</NcActionButton>
		<NcActionButton v-for="option in snoozeOptions"
			:key="option.days"
			:close-after-click="true"
			@click="snooze(option.days)">
			<template #icon>
				<CalendarClock :size="20" />
			</template>
			{{ option.label }}
		</NcActionButton>
	</NcActions>
</template>

<script>
import { tbt } from '../l10n.js'
import { isTaskReadOnly } from '../store/board.js'
import { followUpState } from '../waiting.js'

import { showError } from '@nextcloud/dialogs'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActions from '@nextcloud/vue/components/NcActions'

import BellAlertOutline from 'vue-material-design-icons/BellAlertOutline.vue'
import CalendarClock from 'vue-material-design-icons/CalendarClock.vue'
import CheckIcon from 'vue-material-design-icons/Check.vue'
import TimerSandEmpty from 'vue-material-design-icons/TimerSandEmpty.vue'

export default {
	name: 'TbFollowUpBadge',
	components: {
		BellAlertOutline,
		CalendarClock,
		CheckIcon,
		NcActionButton,
		NcActions,
		TimerSandEmpty,
	},
	props: {
		task: {
			type: Object,
			required: true,
		},
		/** Also show waiting tasks whose follow-up is not due yet */
		showPending: {
			type: Boolean,
			default: false,
		},
	},
	computed: {
		followUp() {
			return this.task.closed ? null : followUpState(this.task)
		},
		due() {
			return this.followUp === 'reached' || this.followUp === 'noDate'
		},
		state() {
			return this.due || (this.showPending && this.followUp === 'pending') ? this.followUp : null
		},
		readOnly() {
			return isTaskReadOnly(this.task)
		},
		date() {
			return this.task.startMoment.isValid() ? this.task.startMoment.format('DD.MM.') : ''
		},
		label() {
			if (this.followUp === 'noDate') {
				return tbt('Follow-up')
			}
			return this.due ? tbt('Follow-up due {date}', { date: this.date }) : tbt('Follow-up {date}', { date: this.date })
		},
		title() {
			if (this.followUp === 'noDate') {
				return tbt('Waiting without follow-up date')
			}
			return this.due ? tbt('Follow-up reached {date}', { date: this.date }) : tbt('Follow-up {date}', { date: this.date })
		},
		snoozeOptions() {
			return [
				{ days: 1, label: tbt('Follow-up tomorrow') },
				{ days: 7, label: tbt('Follow-up in a week') },
				{ days: 14, label: tbt('Follow-up in two weeks') },
			]
		},
	},
	methods: {
		tbt,
		async stop() {
			try {
				await this.$store.dispatch('tbStopWaiting', { task: this.task })
			} catch (error) {
				console.error(error)
				showError(tbt('Could not change the follow-up.'))
			}
		},
		async snooze(days) {
			try {
				await this.$store.dispatch('tbSnoozeFollowUp', { task: this.task, days })
			} catch (error) {
				console.error(error)
				showError(tbt('Could not change the follow-up.'))
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-followup {
	flex-shrink: 0;

	:deep(.button-vue) {
		min-height: 22px;
		height: 22px;
		padding: 0 8px 0 4px;
		border-radius: 6px;
		font-size: 12px;
		font-weight: 600;
		color: color-mix(in srgb, var(--tb-status-waiting, #e09b13) 70%, var(--color-main-text));
		background-color: color-mix(in srgb, var(--tb-status-waiting, #e09b13) 14%, transparent);

		.button-vue__icon {
			min-width: 20px;
			width: 20px;
			height: 22px;
		}
	}

	&--due :deep(.button-vue) {
		color: var(--tb-prio-high, #d1453b);
		background-color: color-mix(in srgb, var(--tb-prio-high, #d1453b) 12%, transparent);
	}
}
</style>
