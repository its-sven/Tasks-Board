<!--
Nextcloud - Tasks

@author Raimund Schlüßler
@copyright 2024 Raimund Schlüßler <raimund.schluessler@mailbox.org>

This library is free software; you can redistribute it and/or
modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
License as published by the Free Software Foundation; either
version 3 of the License, or any later version.

This library is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU AFFERO GENERAL PUBLIC LICENSE for more details.

You should have received a copy of the GNU Affero General Public
License along with this library. If not, see <http://www.gnu.org/licenses/>.

-->

<template>
	<NcActions class="filter reactive"
		force-menu
		:type="isFilterActive ? 'primary' : 'tertiary'"
		:title="t('tasks', 'Active filter')">
		<template #icon>
			<span class="material-design-icon">
				<FilterIcon v-if="isFilterActive" :size="20" />
				<FilterOffIcon v-else :size="20" />
			</span>
		</template>
		<NcActionInput type="multiselect"
			:label="t('tasks', 'Filter by tags')"
			track-by="id"
			:multiple="true"
			:append-to-body="true"
			:options="tags"
			:model-value="filter.tags"
			@update:model-value="setTags">
			<template #icon>
				<TagMultiple :size="20" />
			</template>
			{{ t('tasks', 'Select tags to filter by') }}
		</NcActionInput>
		<!-- Tasks Board: filter by assigned person -->
		<template v-if="tbPeople.length">
			<NcActionCaption :name="tbt('Filter by person')" />
			<NcActionCheckbox v-for="person in tbPeople"
				:key="person.uid"
				:model-value="tbIsSelected(person.uid)"
				@update:model-value="tbTogglePerson(person.uid, $event)">
				{{ person.displayName }}
			</NcActionCheckbox>
			<NcActionCheckbox :model-value="tbIsSelected(tbUnassigned)"
				@update:model-value="tbTogglePerson(tbUnassigned, $event)">
				{{ tbt('Not assigned') }}
			</NcActionCheckbox>
			<NcActionSeparator />
		</template>
		<NcActionButton class="reactive"
			:close-after-click="true"
			@click="resetFilter">
			<template #icon>
				<Close :size="20" />
			</template>
			{{ t('tasks', 'Reset filter') }}
		</NcActionButton>
	</NcActions>
</template>

<script>
import { translate as t } from '@nextcloud/l10n'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActionInput from '@nextcloud/vue/components/NcActionInput'
import NcActionCaption from '@nextcloud/vue/components/NcActionCaption'
import NcActionCheckbox from '@nextcloud/vue/components/NcActionCheckbox'
import NcActionSeparator from '@nextcloud/vue/components/NcActionSeparator'
import { peopleOf, UNASSIGNED } from '../tb/assignee.js'
import { tbt } from '../tb/l10n.js'

import Close from 'vue-material-design-icons/Close.vue'
import FilterIcon from 'vue-material-design-icons/FilterOutline.vue'
import FilterOffIcon from 'vue-material-design-icons/FilterOffOutline.vue'
import TagMultiple from 'vue-material-design-icons/TagMultipleOutline.vue'

import { mapGetters, mapMutations } from 'vuex'

export default {
	name: 'FilterDropdown',
	components: {
		NcActions,
		NcActionButton,
		NcActionInput,
		NcActionCaption,
		NcActionCheckbox,
		NcActionSeparator,
		Close,
		FilterIcon,
		FilterOffIcon,
		TagMultiple,
	},
	computed: {
		...mapGetters({
			tags: 'tags',
			filter: 'filter',
			searchQuery: 'searchQuery',
		}),
		isFilterActive() {
			return this.filter.tags.length || this.searchQuery || this.filter.tbAssignees?.length
		},
		/** Tasks Board: persons that have tasks assigned in the loaded lists */
		tbPeople() {
			const tasks = []
			for (const calendar of this.$store.getters.getSortedCalendars) {
				tasks.push(...Object.values(calendar.tasks))
			}
			return peopleOf(tasks)
		},
		tbUnassigned() {
			return UNASSIGNED
		},
	},
	methods: {
		t,
		...mapMutations(['setFilter', 'setSearchQuery']),

		setTags(tags) {
			const filter = this.filter
			filter.tags = tags
			this.setFilter(filter)
		},

		tbt,
		tbIsSelected(uid) {
			return (this.filter.tbAssignees || []).includes(uid)
		},
		tbTogglePerson(uid, selected) {
			const current = (this.filter.tbAssignees || []).filter(value => value !== uid)
			this.setFilter({ ...this.filter, tbAssignees: selected ? [...current, uid] : current })
		},

		resetFilter() {
			this.setFilter({ tags: [], tbAssignees: [] })
			this.setSearchQuery('')
		},
	},
}
</script>

<style lang="scss" scoped>
// overlay the sort direction icon with the sort order icon
.material-design-icon {
	width: 44px;
	height: 44px;
}
</style>

<style lang="scss">
.vs__dropdown-menu,
.vs__dropdown-menu--floating {
  z-index:100000 !important
}
</style>
