<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Dashboard: new and completed tasks per week (columns side by side).
Can be shown as a table instead.
-->
<template>
	<div class="tb-history">
		<table v-if="asTable" class="tb-history__table">
			<thead>
				<tr>
					<th scope="col">
						{{ weekLabel }}
					</th>
					<th v-for="series in seriesList" :key="series.key" scope="col">
						{{ series.label }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="week in weeks" :key="week.week">
					<th scope="row">
						{{ weekName(week) }} · {{ range(week) }}
					</th>
					<td v-for="series in seriesList" :key="series.key">
						{{ week[series.key] }}
					</td>
				</tr>
			</tbody>
		</table>
		<template v-else>
			<div class="tb-history__legend">
				<span v-for="series in seriesList" :key="series.key" class="tb-history__legend-item">
					<span class="tb-history__swatch" :style="{ 'background-color': 'var(--tb-viz-' + series.color + ')' }" />
					{{ series.label }}
				</span>
			</div>
			<div class="tb-history__plot">
				<div class="tb-history__axis" aria-hidden="true">
					<span v-for="tick in ticks" :key="tick" :style="{ bottom: (tick / max * 100) + '%' }">{{ tick }}</span>
				</div>
				<div class="tb-history__area">
					<span v-for="tick in ticks"
						:key="'grid' + tick"
						class="tb-history__grid"
						:style="{ bottom: (tick / max * 100) + '%' }" />
					<button v-for="(week, index) in weeks"
						:key="week.week"
						type="button"
						class="tb-history__week"
						:class="{ 'tb-history__week--current': index === weeks.length - 1, 'tb-history__week--hover': hover === index }"
						:aria-label="weekName(week) + ': ' + seriesList.map(series => series.label + ' ' + week[series.key]).join(', ')"
						@pointerenter="hover = index"
						@pointerleave="hover = null"
						@focus="hover = index"
						@blur="hover = null">
						<span v-for="series in seriesList"
							:key="series.key"
							class="tb-history__bar"
							:style="{ height: (week[series.key] / max * 100) + '%', 'background-color': 'var(--tb-viz-' + series.color + ')' }" />
					</button>
					<div v-if="hover !== null"
						class="tb-history__tip"
						:style="tipStyle"
						role="tooltip">
						<div class="tb-history__tip-title">
							{{ weekName(weeks[hover]) }} · {{ range(weeks[hover]) }}
						</div>
						<div v-for="series in seriesList" :key="series.key" class="tb-history__tip-row">
							<span class="tb-history__tip-key" :style="{ 'background-color': 'var(--tb-viz-' + series.color + ')' }" />
							<strong>{{ weeks[hover][series.key] }}</strong>
							<span>{{ series.label }}</span>
						</div>
					</div>
				</div>
			</div>
			<div class="tb-history__labels" aria-hidden="true">
				<span v-for="(week, index) in weeks" :key="week.week">
					{{ index % 2 === weeks.length % 2 ? '' : weekName(week) }}
				</span>
			</div>
		</template>
	</div>
</template>

<script>
import { shortDate } from '../dates.js'
import { niceMax } from '../stats.js'

export default {
	name: 'TbDashHistory',
	props: {
		/** From stats.weeklyHistory() */
		weeks: {
			type: Array,
			required: true,
		},
		/** [{ key: 'created'|'completed', label, color }] */
		seriesList: {
			type: Array,
			required: true,
		},
		asTable: {
			type: Boolean,
			default: false,
		},
		weekLabel: {
			type: String,
			default: '',
		},
		weekPrefix: {
			type: String,
			default: 'W',
		},
	},
	data() {
		return {
			hover: null,
		}
	},
	computed: {
		max() {
			return niceMax(Math.max(1, ...this.weeks.flatMap(week => this.seriesList.map(series => week[series.key]))))
		},
		ticks() {
			return [0, this.max / 2, this.max].map(value => Math.round(value * 10) / 10)
		},
		tipStyle() {
			const position = (this.hover + 0.5) / this.weeks.length * 100
			return position > 60 ? { right: (100 - position + 3) + '%' } : { left: (position + 3) + '%' }
		},
	},
	methods: {
		weekName(week) {
			return this.weekPrefix + ' ' + week.week
		},
		range(week) {
			return shortDate(week.start) + '–' + shortDate(week.start.clone().add(6, 'days'))
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-history {
	&__legend {
		display: flex;
		gap: 16px;
		margin-bottom: 8px;
		font-size: 13px;
	}

	&__legend-item {
		display: inline-flex;
		align-items: center;
		gap: 6px;
	}

	&__swatch {
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}

	&__plot {
		display: flex;
		gap: 6px;
		height: 170px;
	}

	&__axis {
		position: relative;
		flex: 0 0 26px;

		span {
			position: absolute;
			right: 0;
			transform: translateY(50%);
			color: var(--color-text-maxcontrast);
			font-size: 11px;
			font-variant-numeric: tabular-nums;
		}
	}

	&__area {
		position: relative;
		display: flex;
		flex: 1 1 auto;
		align-items: flex-end;
		min-width: 0;
	}

	&__grid {
		position: absolute;
		left: 0;
		right: 0;
		height: 1px;
		background-color: var(--tb-viz-grid);
		pointer-events: none;
	}

	&__week {
		position: relative;
		display: flex;
		flex: 1 1 0;
		align-items: flex-end;
		justify-content: center;
		gap: 2px;
		height: 100%;
		min-width: 0;
		margin: 0;
		padding: 0 2px;
		border: none;
		border-radius: 6px 6px 0 0;
		background: transparent;
		cursor: default;

		&--hover {
			background-color: color-mix(in srgb, var(--color-background-hover) 70%, transparent);
		}

		&:focus-visible {
			outline: 2px solid var(--color-primary-element);
		}
	}

	&__bar {
		flex: 0 1 12px;
		max-width: 12px;
		min-height: 0;
		border-radius: 4px 4px 0 0;
	}

	&__labels {
		display: flex;
		margin-left: 32px;
		padding-top: 4px;

		span {
			flex: 1 1 0;
			color: var(--color-text-maxcontrast);
			font-size: 11px;
			text-align: center;
			white-space: nowrap;
		}
	}

	&__tip {
		position: absolute;
		top: 4px;
		z-index: 20;
		min-width: 150px;
		padding: 8px 10px;
		border: 1px solid var(--color-border);
		border-radius: 8px;
		background-color: var(--color-main-background);
		box-shadow: 0 4px 16px rgba(0, 0, 0, .16);
		font-size: 12px;
		pointer-events: none;
	}

	&__tip-title {
		margin-bottom: 4px;
		color: var(--color-text-maxcontrast);
	}

	&__tip-row {
		display: flex;
		align-items: center;
		gap: 6px;

		strong {
			min-width: 22px;
			font-variant-numeric: tabular-nums;
		}
	}

	&__tip-key {
		width: 10px;
		height: 2px;
		border-radius: 1px;
	}

	&__table {
		width: 100%;
		border-collapse: collapse;
		font-size: 13px;

		th,
		td {
			padding: 5px 6px;
			border-bottom: 1px solid var(--color-border);
			text-align: end;
			font-variant-numeric: tabular-nums;
		}

		th:first-child {
			text-align: start;
			font-weight: normal;
		}

		thead th {
			color: var(--color-text-maxcontrast);
			font-weight: 600;
		}
	}
}
</style>
