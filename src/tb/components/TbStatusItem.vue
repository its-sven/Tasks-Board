<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<MultiselectItem class="tb-status-item"
		:value="current"
		:options="options"
		:disabled="disabled"
		:placeholder="t('tasks', 'Select a status')"
		icon="IconPulse"
		@change-value="select" />
	<TbWaitDialog v-if="waitDialog"
		:task="task"
		@confirm="confirmWait"
		@cancel="waitDialog = false" />
</template>

<script>
import MultiselectItem from '../../components/AppSidebar/MultiselectItem.vue'
import { tbt } from '../l10n.js'
import { STATUS } from '../status.js'
import { boardColumn } from '../waiting.js'
import TbWaitDialog from './TbWaitDialog.vue'

import { showError } from '@nextcloud/dialogs'
import { translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'

/**
 * The status of a task as one of the five board states
 * (Open, In progress, Waiting, Done, Cancelled)
 */
export default {
	name: 'TbStatusItem',
	components: {
		MultiselectItem,
		TbWaitDialog,
	},
	inheritAttrs: false,
	props: {
		task: {
			type: Object,
			required: true,
		},
		disabled: {
			type: Boolean,
			default: false,
		},
	},
	data() {
		return {
			waitDialog: false,
		}
	},
	computed: {
		options() {
			return Object.entries(STATUS).map(([column, status]) => ({
				displayName: tbt(status.label) + (column === 'waiting' ? ' …' : ''),
				type: column,
				icon: status.icon,
				optionClass: 'tb-status-option tb-status-option--' + column,
			}))
		},
		column() {
			return boardColumn(this.task, moment())
		},
		current() {
			const option = this.options.find(entry => entry.type === this.column)
			return option ? { ...option, displayName: tbt(STATUS[option.type].label) } : null
		},
	},
	methods: {
		t,
		async select(option) {
			if (option.type === 'waiting') {
				// Also when the task already waits: pick a new follow-up date
				this.waitDialog = true
				return
			}
			if (option.type === this.column) {
				return
			}
			await this.move({ column: option.type })
		},
		async confirmWait(date) {
			this.waitDialog = false
			await this.move({ column: 'waiting', waitUntil: date })
		},
		async move(change) {
			try {
				await this.$store.dispatch('moveTaskToBoardColumn', { task: this.task, ...change })
			} catch (error) {
				console.error(error)
				showError(tbt('Could not change the task.'))
			}
		},
	},
}
</script>
