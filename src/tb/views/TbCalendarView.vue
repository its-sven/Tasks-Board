<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div v-if="isBoard && calendar">
		<HeaderBar />
		<TbBoard :calendars="[calendar]" :view-key="viewKey" />
	</div>
	<div v-else-if="isTable && calendar">
		<HeaderBar />
		<TbTable :calendars="[calendar]" :view-key="viewKey" />
	</div>
	<TbGroupedList v-else-if="calendar && grouping !== 'none'"
		:calendar="calendar"
		:grouping="grouping" />
	<Calendar v-else :calendar-id="calendarId" :task-id="taskId" />
</template>

<script>
import HeaderBar from '../../components/HeaderBar.vue'
import Calendar from '../../views/AppContent/Calendar.vue'
import { viewKeyForRoute } from '../board.js'
import TbBoard from '../components/TbBoard.vue'
import TbGroupedList from '../components/TbGroupedList.vue'
import TbTable from '../components/TbTable.vue'
import currentKey from './currentKey.js'

export default {
	name: 'TbCalendarView',
	components: {
		Calendar,
		HeaderBar,
		TbBoard,
		TbGroupedList,
		TbTable,
	},
	mixins: [currentKey],
	props: {
		calendarId: {
			type: String,
			default: '',
		},
		taskId: {
			type: String,
			default: '',
		},
	},
	computed: {
		calendar() {
			return this.$store.getters.getCalendarByRoute(this.$route)
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
