<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
New list for a group in one step. In Nextcloud a list always belongs to a
person (CalDAV calendars live below principals/users/…); groups can only get
shares. So the list is created for the current person and shared with the
group right away.
-->
<template>
	<NcDialog :name="tbt('New list for a group')"
		:open="true"
		size="normal"
		:buttons="buttons"
		class="tb-group-list"
		@update:open="onOpen">
		<div class="tb-group-list__form">
			<NcTextField ref="name"
				v-model="name"
				class="tb-group-list__name"
				:label="tbt('Name of the list')"
				:error="!!nameError"
				:helper-text="nameError"
				@keydown.enter.prevent="create" />
			<div class="tb-group-list__color">
				<span class="tb-group-list__label">{{ tbt('Color') }}</span>
				<Colorpicker :selected-color="color" @color-selected="color = $event" />
			</div>
			<div class="tb-group-list__group">
				<label class="tb-group-list__label" for="tb-group-list-group">{{ tbt('Group') }}</label>
				<NcSelect v-model="group"
					input-id="tb-group-list-group"
					:options="groups"
					:loading="searching"
					:filterable="false"
					:placeholder="tbt('Search for a group…')"
					label="displayName"
					:append-to-body="false"
					@search="search">
					<template #no-options>
						{{ query.length < 1 ? tbt('Type to search for a group.') : tbt('No group found.') }}
					</template>
				</NcSelect>
			</div>
			<NcCheckboxRadioSwitch v-model="writable">
				{{ tbt('Members can edit the tasks') }}
			</NcCheckboxRadioSwitch>
			<p class="tb-group-list__hint">
				{{ tbt('The list belongs to you and is shared with the group. Everyone in the group sees it in their lists, also people who join the group later.') }}
			</p>
		</div>
	</NcDialog>
</template>

<script>
import Colorpicker from '../../components/AppNavigation/Colorpicker.vue'
import { searchGroups } from '../groups.js'
import { tbt } from '../l10n.js'

import { showError, showSuccess } from '@nextcloud/dialogs'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcSelect from '@nextcloud/vue/components/NcSelect'
import NcTextField from '@nextcloud/vue/components/NcTextField'

import debounce from 'debounce'

export default {
	name: 'TbGroupListDialog',
	components: {
		Colorpicker,
		NcCheckboxRadioSwitch,
		NcDialog,
		NcSelect,
		NcTextField,
	},
	inject: {
		$OCA: { default: () => window.OCA || {} },
	},
	emits: ['close'],
	data() {
		return {
			name: '',
			color: this.$OCA?.Theming?.color || '#0082C9',
			group: null,
			groups: [],
			query: '',
			searching: false,
			writable: true,
			busy: false,
		}
	},
	computed: {
		nameError() {
			const name = this.name.trim()
			if (name && this.$store.getters.isCalendarNameUsed(name)) {
				return tbt('The name "{name}" is already used.', { name })
			}
			return ''
		},
		buttons() {
			return [
				{ label: tbt('Cancel'), callback: () => this.$emit('close') },
				{
					label: tbt('Create and share'),
					variant: 'primary',
					disabled: this.busy || !this.name.trim() || !!this.nameError || !this.group,
					callback: () => {
						this.create()
						// Keep the dialog open until the list exists
						return false
					},
				},
			]
		},
	},
	mounted() {
		this.$nextTick(() => this.$refs.name?.focus?.())
	},
	methods: {
		tbt,
		onOpen(open) {
			if (!open) {
				this.$emit('close')
			}
		},
		search: debounce(async function(query) {
			this.query = query || ''
			if (this.query.length < 1) {
				this.groups = []
				return
			}
			this.searching = true
			try {
				this.groups = await searchGroups(this.query)
			} finally {
				this.searching = false
			}
		}, 400),
		async create() {
			const displayName = this.name.trim()
			if (this.busy || !displayName || this.nameError || !this.group) {
				return
			}
			this.busy = true
			let calendar = null
			try {
				calendar = await this.$store.dispatch('appendCalendar', { displayName, color: this.color })
				if (!calendar) {
					throw new Error('The list was not created')
				}
			} catch (error) {
				console.error(error)
				showError(tbt('The list could not be created.'))
				this.busy = false
				return
			}
			const group = this.group
			try {
				await this.$store.dispatch('shareCalendar', { calendar, user: group.groupId, displayName: group.displayName, uri: group.uri, isGroup: true, isCircle: false })
				if (this.writable) {
					await this.$store.dispatch('toggleShareeWritable', { calendar, uri: group.uri, writeable: true })
				}
				showSuccess(tbt('List "{list}" created and shared with "{group}".', { list: displayName, group: group.displayName }))
			} catch (error) {
				console.error(error)
				showError(tbt('The list was created, but it could not be shared with "{group}". You can share it in the menu of the list.', { group: group.displayName }))
			}
			this.busy = false
			this.$emit('close')
			await this.$router.push({ name: 'calendars', params: { calendarId: calendar.id } })
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-group-list {
	&__form {
		display: flex;
		flex-direction: column;
		gap: calc(3 * var(--default-grid-baseline));
		padding-bottom: var(--default-grid-baseline);
	}

	&__label {
		display: block;
		margin-bottom: 4px;
		font-weight: 600;
	}

	&__color {
		display: flex;
		flex-direction: column;
	}

	&__group :deep(.v-select) {
		width: 100%;
	}

	&__hint {
		color: var(--color-text-maxcontrast);
	}
}
</style>
