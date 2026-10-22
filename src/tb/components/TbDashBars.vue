<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Dashboard: open tasks per group (person, list, project, priority, tag) as
horizontal bars, stacked by work state. A click on a row filters the dashboard.
Can be shown as a table instead.
-->
<template>
	<div class="tb-bars">
		<table v-if="asTable" class="tb-bars__table">
			<thead>
				<tr>
					<th scope="col">
						{{ groupLabel }}
					</th>
					<th v-for="state in states" :key="state.key" scope="col">
						{{ state.label }}
					</th>
					<th scope="col">
						{{ totalLabel }}
					</th>
				</tr>
			</thead>
			<tbody>
				<tr v-for="group in groups" :key="group.key">
					<th scope="row">
						{{ group.label }}
					</th>
					<td v-for="state in states" :key="state.key">
						{{ group.counts[state.key] }}
					</td>
					<td><strong>{{ group.total }}</strong></td>
				</tr>
			</tbody>
		</table>
		<ul v-else class="tb-bars__list">
			<li v-for="group in groups"
				:key="group.key"
				class="tb-bars__row"
				:class="{ 'tb-bars__row--pickable': pickable(group), 'tb-bars__row--active': active === group.key }">
				<button type="button"
					class="tb-bars__button"
					:disabled="!pickable(group)"
					:title="pickable(group) ? pickTitle : null"
					:aria-label="rowLabel(group)"
					@click="$emit('pick', group)"
					@pointerenter="showTip(group, $event)"
					@pointermove="moveTip($event)"
					@pointerleave="tip = null"
					@focus="showTip(group, $event)"
					@blur="tip = null">
					<span class="tb-bars__label">
						<span v-if="group.color" class="tb-bars__dot" :style="{ 'background-color': group.color }" />
						<span class="tb-bars__name">{{ group.label }}</span>
					</span>
					<span class="tb-bars__track">
						<span class="tb-bars__stack" :style="{ width: 'calc((100% - 44px) * ' + (group.total / scale).toFixed(4) + ')' }">
							<span v-for="state in statesOf(group)"
								:key="state.key"
								class="tb-bars__segment"
								:style="{ flexGrow: group.counts[state.key], 'background-color': 'var(--tb-viz-' + state.key + ')' }" />
						</span>
						<span class="tb-bars__total">{{ group.total }}</span>
					</span>
				</button>
			</li>
		</ul>
		<p v-if="!groups.length" class="tb-bars__empty">
			{{ emptyLabel }}
		</p>
		<div v-if="tip"
			class="tb-bars__tip"
			:style="{ left: tip.x + 'px', top: tip.y + 'px' }"
			role="tooltip">
			<div class="tb-bars__tip-title">
				{{ tip.group.label }}
			</div>
			<div v-for="state in states" :key="state.key" class="tb-bars__tip-row">
				<span class="tb-bars__tip-key" :style="{ 'background-color': 'var(--tb-viz-' + state.key + ')' }" />
				<strong>{{ tip.group.counts[state.key] }}</strong>
				<span>{{ state.label }}</span>
			</div>
		</div>
	</div>
</template>

<script>
import { niceMax } from '../stats.js'

export default {
	name: 'TbDashBars',
	props: {
		/** Groups from stats.breakdown() with labels */
		groups: {
			type: Array,
			required: true,
		},
		/** [{ key, label }] in the stacking order */
		states: {
			type: Array,
			required: true,
		},
		asTable: {
			type: Boolean,
			default: false,
		},
		groupLabel: {
			type: String,
			default: '',
		},
		totalLabel: {
			type: String,
			default: '',
		},
		emptyLabel: {
			type: String,
			default: '',
		},
		pickTitle: {
			type: String,
			default: '',
		},
		/** Key of the group the dashboard is filtered by */
		active: {
			type: String,
			default: null,
		},
		/** Groups that cannot be picked (e.g. "other") */
		notPickable: {
			type: Array,
			default: () => ['__other__'],
		},
	},
	emits: ['pick'],
	data() {
		return {
			tip: null,
		}
	},
	computed: {
		scale() {
			return niceMax(Math.max(1, ...this.groups.map(group => group.total)))
		},
	},
	methods: {
		pickable(group) {
			return !this.notPickable.includes(group.key)
		},
		statesOf(group) {
			return this.states.filter(state => group.counts[state.key] > 0)
		},
		rowLabel(group) {
			return group.label + ': ' + group.total + ' (' + this.states.map(state => state.label + ' ' + group.counts[state.key]).join(', ') + ')'
		},
		position($event) {
			const box = this.$el.getBoundingClientRect()
			if ($event.clientX === undefined) {
				const target = $event.target.getBoundingClientRect()
				return { x: target.left - box.left + 140, y: target.bottom - box.top + 4 }
			}
			return { x: Math.min($event.clientX - box.left + 12, box.width - 180), y: $event.clientY - box.top + 14 }
		},
		showTip(group, $event) {
			this.tip = { group, ...this.position($event) }
		},
		moveTip($event) {
			if (this.tip) {
				this.tip = { ...this.tip, ...this.position($event) }
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-bars {
	position: relative;

	&__list {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	&__button {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-height: 30px;
		margin: 0;
		padding: 2px 6px;
		border: none;
		border-radius: 6px;
		background: transparent;
		color: var(--color-main-text);
		font: inherit;
		font-weight: normal;
		text-align: start;
		cursor: default;

		&:disabled {
			opacity: 1;
			background: transparent;
		}
	}

	&__row--pickable &__button {
		cursor: pointer;

		&:hover,
		&:focus-visible {
			background-color: var(--color-background-hover);
		}
	}

	&__row--active &__button {
		background-color: var(--color-background-hover);
		box-shadow: inset 3px 0 0 var(--color-primary-element);
	}

	&__label {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 0 0 42%;
		max-width: 210px;
		min-width: 0;
		font-size: 13px;
	}

	&__name {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	&__dot {
		flex: 0 0 auto;
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}

	&__track {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 1 1 auto;
		min-width: 0;
	}

	&__stack {
		display: flex;
		flex: 0 0 auto;
		gap: 2px;
		min-width: 4px;
		height: 16px;

		.tb-bars__segment:last-child {
			border-radius: 0 4px 4px 0;
		}
	}

	&__segment {
		flex-basis: 0;
		min-width: 3px;
		height: 100%;
	}

	&__total {
		flex: 0 0 auto;
		color: var(--color-main-text);
		font-size: 13px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	&__empty {
		padding: 16px 0;
		color: var(--color-text-maxcontrast);
		text-align: center;
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

	&__tip {
		position: absolute;
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
}
</style>
