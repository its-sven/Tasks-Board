<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div v-if="isBoard">
		<HeaderBar />
		<TbBoard :calendars="calendars"
			:collection-id="collectionId"
			:view-key="viewKey" />
	</div>
	<div v-else-if="isTable">
		<HeaderBar />
		<TbTable :calendars="calendars"
			:collection-id="collectionId"
			:view-key="viewKey" />
	</div>
	<TbGroupedList v-else-if="grouping !== 'none' && collectionId !== 'week'"
		:collection-id="collectionId"
		:grouping="grouping" />
	<Collections v-else />
</template>

<script>
import HeaderBar from '../../components/HeaderBar.vue'
import Collections from '../../views/AppContent/Collections.vue'
import { viewKeyForRoute } from '../board.js'
import TbBoard from '../components/TbBoard.vue'
import TbGroupedList from '../components/TbGroupedList.vue'
import TbTable from '../components/TbTable.vue'
import currentKey from './currentKey.js'

export default {
	name: 'TbCollectionsView',
	components: {
		Collections,
		HeaderBar,
		TbBoard,
		TbGroupedList,
		TbTable,
	},
	mixins: [currentKey],
	props: {
		collectionId: {
			type: String,
			default: '',
		},
		taskId: {
			type: String,
			default: '',
		},
		collectionParam: {
			type: String,
			default: '',
		},
	},
	computed: {
		calendars() {
			return this.$store.getters.getSortedCalendars
		},
		viewKey() {
			return viewKeyForRoute(this.$route)
		},
		grouping() {
			return this.$store.getters.tbGrouping
		},
		isBoard() {
			return !!this.viewKey && this.$store.getters.tbView(this.viewKey).mode === 'board'
		},
		isTable() {
			return !!this.viewKey && this.$store.getters.tbView(this.viewKey).mode === 'table'
		},
	},
}
</script>
