<!--
Nextcloud - Tasks

@author Raimund Schlüßler
@copyright 2018 Raimund Schlüßler <raimund.schluessler@mailbox.org>

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
	<NcAppNavigationSettings :name="appNavigationSettingsName">
		<div class="reactive">
			<ul>
				<li>
					<label for="defaultCalendar">
						{{ t('tasks', 'Default list') }}
					</label>
					<select id="defaultCalendar" v-model="defaultCalendarId">
						<option v-for="calendar in calendars"
							:key="calendar.id"
							:value="calendar.id">
							{{ calendar.displayName }}
						</option>
					</select>
				</li>
				<li class="headline">
					{{ t('tasks', 'Visibility of Smart Collections') }}
				</li>
				<!-- Tasks Board: in the order of the navigation, with arrows to change it -->
				<li v-for="(collection, index) in tbCollections"
					:key="collection.id"
					class="collection"
					:data-tb-nav="collection.id">
					<component :is="collection.icon" :size="20" />
					<span class="label-container">
						<label :for="'visibilityCollection-' + collection.id" :title="collection.displayName">
							{{ collection.displayName }}
						</label>
					</span>
					<select v-if="collection.id !== 'dashboard'"
						:id="'visibilityCollection-' + collection.id"
						:value="collection.show"
						@change="setVisibility({ id: collection.id, show: +$event.target.value })">
						<option v-for="collectionOption in collectionOptions"
							:key="collectionOption.id"
							:value="collectionOption.id">
							{{ collectionOption.name }}
						</option>
					</select>
					<span class="tb-order">
						<button type="button"
							class="tb-order__button tb-order__up"
							:disabled="index === 0"
							:aria-label="tbt('Move up: {name}', { name: collection.displayName })"
							:title="tbt('Move up')"
							@click="tbMove(index, index - 1)">
							<ChevronUp :size="16" />
						</button>
						<button type="button"
							class="tb-order__button tb-order__down"
							:disabled="index === tbCollections.length - 1"
							:aria-label="tbt('Move down: {name}', { name: collection.displayName })"
							:title="tbt('Move down')"
							@click="tbMove(index, index + 1)">
							<ChevronDown :size="16" />
						</button>
					</span>
				</li>
			</ul>
			<TbSettingsSection />
		</div>
	</NcAppNavigationSettings>
</template>

<script>
import { translate as t } from '@nextcloud/l10n'
import moment from '@nextcloud/moment'
import NcAppNavigationSettings from '@nextcloud/vue/components/NcAppNavigationSettings'

// Tasks Board: icons of the own collections and the dashboard, arrows for the order
import AccountCheckOutline from 'vue-material-design-icons/AccountCheckOutline.vue'
import BellAlertOutline from 'vue-material-design-icons/BellAlertOutline.vue'
import ChevronDown from 'vue-material-design-icons/ChevronDown.vue'
import ChevronUp from 'vue-material-design-icons/ChevronUp.vue'
import TimerSandEmpty from 'vue-material-design-icons/TimerSandEmpty.vue'
import ViewDashboardOutline from 'vue-material-design-icons/ViewDashboardOutline.vue'

import CalendarToday from 'vue-material-design-icons/CalendarToday.vue'
import CalendarWeek from 'vue-material-design-icons/CalendarWeek.vue'
import CircleOutline from 'vue-material-design-icons/CircleOutline.vue'
import Check from 'vue-material-design-icons/Check.vue'
import Star from 'vue-material-design-icons/StarOutline.vue'
import TrendingUp from 'vue-material-design-icons/TrendingUp.vue'

import { mapState, mapGetters, mapActions } from 'vuex'

import TbSettingsSection from '../../tb/components/TbSettingsSection.vue'
import { tbt } from '../../tb/l10n.js'
import { moveEntry } from '../../tb/navigation.js'

export default {
	components: {
		NcAppNavigationSettings,
		TbSettingsSection,
		AccountCheckOutline,
		BellAlertOutline,
		ChevronDown,
		ChevronUp,
		TimerSandEmpty,
		ViewDashboardOutline,
		CalendarToday,
		CalendarWeek,
		CircleOutline,
		Check,
		Star,
		TrendingUp,
	},
	data() {
		return {
			collectionOptions: [
				{
					id: 0,
					name: t('tasks', 'Hidden'),
				},
				{
					id: 1,
					name: t('tasks', 'Visible'),
				},
				{
					id: 2,
					name: t('tasks', 'Automatic'),
				},
			],
			dayOfMonth: moment().date(),
		}
	},
	computed: {
		appNavigationSettingsName() {
			return t('tasks', 'Tasks settings')
		},

		defaultCalendarId: {
			get() {
				const cal = this.$store.getters.getDefaultCalendar
				return cal ? cal.id : ''
			},
			set(value) {
				this.$store.dispatch('setSetting', { type: 'defaultCalendarId', value })
			},
		},
		...mapState({
			collections: state => state.collections.collections,
		}),
		...mapGetters({
			calendars: 'getSortedWritableCalendars',
		}),
		/**
		 * Tasks Board: the dashboard and the collections in the order of the navigation
		 *
		 * @return {Array}
		 */
		tbCollections() {
			const byId = Object.fromEntries(this.collections.map(collection => [collection.id, collection]))
			return this.$store.getters.tbNavigationOrder
				.map(id => (id === 'dashboard' ? { id, displayName: tbt('Dashboard'), icon: 'ViewDashboardOutline' } : byId[id]))
				.filter(Boolean)
		},
	},
	methods: {
		t,
		tbt,
		tbMove(from, to) {
			const order = this.tbCollections.map(collection => collection.id)
			this.$store.dispatch('setTbNavigationOrder', moveEntry(order, from, to))
		},

		...mapActions([
			'setVisibility',
		]),
	},
}
</script>

<style lang="scss" scoped>
li {
	display: flex;
	align-items: center;
	height: 44px;

	&.headline {
		font-weight: bold;
	}

	&.collection {
		> .material-design-icon {
			margin-right: 12px;
		}

		.label-container {
			white-space: nowrap;
			text-overflow: ellipsis;
			overflow: hidden;
			display: flex;
			align-items: center;
			// Tasks Board: the name gets shortened, not the select
			flex: 1 1 auto;
			min-width: 0;

			label {
				overflow: hidden;
				text-overflow: ellipsis;
			}
		}

		select {
			flex-shrink: 0;
		}
	}

	select {
		min-width: 105px;
		text-overflow: ellipsis;
		margin-left: auto;
	}

	// Tasks Board: arrows for the order, on top of each other to leave room for the name
	.tb-order {
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		margin-left: 2px;
	}

	.label-container + .tb-order {
		margin-left: auto;
	}

	.tb-order__button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 18px;
		min-height: 0;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 4px;
		background: transparent;
		color: var(--color-text-maxcontrast);
		cursor: pointer;

		.material-design-icon {
			margin: 0 !important;
		}

		&:hover:not(:disabled),
		&:focus-visible {
			background-color: var(--color-background-hover);
			color: var(--color-main-text);
		}

		&:disabled {
			opacity: .3;
			cursor: default;
		}
	}

	label {
		white-space: nowrap;
		padding-right: 10px;
	}
}
</style>
