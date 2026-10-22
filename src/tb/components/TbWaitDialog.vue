<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<NcDialog :name="tbt('Set follow-up date')"
		:open="true"
		size="small"
		:buttons="buttons"
		class="tb-wait-dialog"
		@update:open="onOpen">
		<p class="tb-wait-dialog__task">
			{{ task.summary }}
		</p>
		<NcDateTimePickerNative id="tb-wait-dialog-date"
			v-model="date"
			type="date"
			:min="tomorrow"
			:label="tbt('Wait until')" />
		<div class="tb-wait-dialog__quick">
			<NcButton v-for="quick in quickPicks"
				:key="quick.label"
				size="small"
				variant="secondary"
				@click="date = quick.date">
				{{ quick.label }}
			</NcButton>
		</div>
		<p class="tb-wait-dialog__hint">
			{{ tbt('The task gets the tag "{tag}" and stays out of "Current" until this date.', { tag: waitingTag }) }}
		</p>
	</NcDialog>
</template>

<script>
import { waitingTag } from '../board.js'
import { tbt } from '../l10n.js'

import moment from '@nextcloud/moment'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDateTimePickerNative from '@nextcloud/vue/components/NcDateTimePickerNative'
import NcDialog from '@nextcloud/vue/components/NcDialog'

export default {
	name: 'TbWaitDialog',
	components: {
		NcButton,
		NcDateTimePickerNative,
		NcDialog,
	},
	props: {
		task: {
			type: Object,
			required: true,
		},
	},
	emits: ['confirm', 'cancel'],
	data() {
		const start = this.task.startMoment
		const initial = start.isValid() && start.isAfter(moment(), 'day') ? start : moment().add(7, 'days')
		return {
			date: initial.clone().startOf('day').toDate(),
			done: false,
		}
	},
	computed: {
		waitingTag() {
			return waitingTag()
		},
		tomorrow() {
			return moment().add(1, 'day').startOf('day').toDate()
		},
		quickPicks() {
			return [
				{ label: tbt('1 week'), date: moment().add(1, 'week').startOf('day').toDate() },
				{ label: tbt('2 weeks'), date: moment().add(2, 'weeks').startOf('day').toDate() },
				{ label: tbt('1 month'), date: moment().add(1, 'month').startOf('day').toDate() },
			]
		},
		buttons() {
			return [
				{ label: tbt('Cancel'), callback: () => this.finish(false) },
				{ label: tbt('Set follow-up date'), variant: 'primary', disabled: !this.date, callback: () => this.finish(true) },
			]
		},
	},
	methods: {
		tbt,
		finish(confirmed) {
			if (this.done) {
				return
			}
			this.done = true
			if (confirmed && this.date) {
				this.$emit('confirm', this.date)
			} else {
				this.$emit('cancel')
			}
		},
		onOpen(open) {
			if (!open) {
				this.finish(false)
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-wait-dialog {
	&__task {
		font-weight: bold;
		margin-bottom: calc(2 * var(--default-grid-baseline));
	}

	&__quick {
		display: flex;
		flex-wrap: wrap;
		gap: var(--default-grid-baseline);
		margin-top: calc(2 * var(--default-grid-baseline));
	}

	&__hint {
		color: var(--color-text-maxcontrast);
		margin-top: calc(2 * var(--default-grid-baseline));
	}
}
</style>
