<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Sidebar row "Assigned to": one person with access to the list.
-->
<template>
	<div class="property__item tb-assignee"
		:class="{ 'property__item--readonly': readOnly }">
		<span class="tb-assignee__icon">
			<AccountOutline :size="20" />
		</span>
		<div v-if="readOnly" class="tb-assignee__readonly">
			<TbAvatar v-if="assignee"
				:person="assignee"
				:size="24"
				show-name />
			<span v-else class="tb-assignee__empty">{{ tbt('Not assigned') }}</span>
		</div>
		<NcSelectUsers v-else
			class="tb-assignee__select"
			:model-value="selected"
			:options="options"
			:loading="loading"
			:placeholder="tbt('Assign to …')"
			:input-label="tbt('Assigned to')"
			:label-outside="true"
			:aria-label-clear-selected="tbt('Remove assignment')"
			@update:model-value="change" />
	</div>
</template>

<script>
import { tbt } from '../l10n.js'
import { assigneeOf } from '../assignee.js'
import TbAvatar from './TbAvatar.vue'

import { showError } from '@nextcloud/dialogs'
import NcSelectUsers from '@nextcloud/vue/components/NcSelectUsers'

import AccountOutline from 'vue-material-design-icons/AccountOutline.vue'

/**
 * @param {object} person { uid, displayName, email }
 * @return {object} Option for NcSelectUsers
 */
function toOption(person) {
	return {
		id: person.uid,
		user: person.uid,
		displayName: person.displayName || person.uid,
		subname: person.email || '',
		email: person.email || '',
		// Passed on to the avatar: no user status request per person
		hideStatus: true,
	}
}

export default {
	name: 'TbAssigneeItem',
	components: {
		AccountOutline,
		NcSelectUsers,
		TbAvatar,
	},
	props: {
		task: {
			type: Object,
			required: true,
		},
		readOnly: {
			type: Boolean,
			default: false,
		},
	},
	computed: {
		assignee() {
			return assigneeOf(this.task)
		},
		people() {
			return this.$store.getters.tbAssigneesFor(this.task.calendar.id)
		},
		loading() {
			return !!this.$store.state.tbAssignment.assignees[this.task.calendar.id]?.loading
		},
		options() {
			const options = this.people.map(toOption)
			// Keep showing an assignee who no longer has access (e.g. share removed)
			if (this.assignee && !options.some(option => option.id === this.assignee.uid)) {
				options.unshift(toOption(this.assignee))
			}
			return options
		},
		selected() {
			return this.assignee ? (this.options.find(option => option.id === this.assignee.uid) || toOption(this.assignee)) : null
		},
	},
	watch: {
		'task.calendar.id': {
			immediate: true,
			handler() {
				if (!this.readOnly) {
					this.$store.dispatch('loadTbAssignees', { calendar: this.task.calendar })
				}
			},
		},
	},
	methods: {
		tbt,
		async change(option) {
			const person = option ? { uid: option.id, displayName: option.displayName, email: option.email } : null
			try {
				await this.$store.dispatch('setTbAssignee', { task: this.task, person })
			} catch (error) {
				console.error(error)
				showError(tbt('Could not change the assignment.'))
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-assignee {
	display: flex;
	align-items: center;
	width: 100%;
	min-height: var(--default-clickable-area);
	padding: 0 6px;
	color: var(--color-text-lighter);

	&__icon {
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: var(--default-clickable-area);
		height: var(--default-clickable-area);
		opacity: .7;
	}

	&__select {
		flex-grow: 1;
		min-width: 0;
		margin: 0 !important;
	}

	&__readonly {
		display: flex;
		align-items: center;
		min-width: 0;
		padding-left: 4px;
		color: var(--color-main-text);
	}

	&__empty {
		color: var(--color-text-maxcontrast);
	}
}
</style>
