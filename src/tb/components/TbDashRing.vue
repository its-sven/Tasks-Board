<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Dashboard: open tasks by work state as a ring, the number of open tasks in the
middle (the one big number of the page) and a legend with the counts.
-->
<template>
	<div class="tb-ring">
		<div class="tb-ring__chart">
			<svg viewBox="0 0 200 200"
				class="tb-ring__svg"
				role="img"
				:aria-label="ariaLabel">
				<circle v-if="!arcs.length"
					cx="100"
					cy="100"
					:r="radius"
					class="tb-ring__track"
					:stroke-width="width" />
				<path v-for="segment in arcs"
					:key="segment.key"
					:d="segment.path"
					class="tb-ring__arc"
					:class="{ 'tb-ring__arc--active': hover === segment.key }"
					:stroke="'var(--tb-viz-' + segment.key + ')'"
					:stroke-width="width"
					tabindex="0"
					:aria-label="segment.label + ': ' + segment.value"
					@pointerenter="hover = segment.key"
					@pointerleave="hover = null"
					@focus="hover = segment.key"
					@blur="hover = null" />
			</svg>
			<div class="tb-ring__center">
				<template v-if="hoverSegment">
					<span class="tb-ring__value">{{ hoverSegment.value }}</span>
					<span class="tb-ring__label">{{ hoverSegment.label }}</span>
				</template>
				<template v-else>
					<span class="tb-ring__value">{{ total }}</span>
					<span class="tb-ring__label">{{ centerLabel }}</span>
				</template>
			</div>
		</div>
		<ul class="tb-ring__legend">
			<li v-for="segment in segments"
				:key="segment.key"
				:class="{ 'tb-ring__legend-item--active': hover === segment.key }"
				@pointerenter="hover = segment.key"
				@pointerleave="hover = null">
				<span class="tb-ring__swatch" :style="{ 'background-color': 'var(--tb-viz-' + segment.key + ')' }" />
				<span class="tb-ring__legend-label">{{ segment.label }}</span>
				<span class="tb-ring__legend-value">{{ segment.value }}</span>
			</li>
		</ul>
	</div>
</template>

<script>
/** Gap between the segments in degrees (the surface shows through) */
const GAP = 2.2

/**
 * @param {number} angle Degrees, 0 = top
 * @param {number} radius Radius
 * @return {number[]} x, y
 */
function point(angle, radius) {
	const rad = (angle - 90) * Math.PI / 180
	return [100 + radius * Math.cos(rad), 100 + radius * Math.sin(rad)]
}

export default {
	name: 'TbDashRing',
	props: {
		/** [{ key, label, value }] in the order of the ring */
		segments: {
			type: Array,
			required: true,
		},
		total: {
			type: Number,
			required: true,
		},
		centerLabel: {
			type: String,
			default: '',
		},
	},
	data() {
		return {
			hover: null,
			radius: 78,
			width: 22,
		}
	},
	computed: {
		hoverSegment() {
			return this.segments.find(segment => segment.key === this.hover) || null
		},
		ariaLabel() {
			return this.centerLabel + ': ' + this.total + '. ' + this.segments.map(segment => segment.label + ' ' + segment.value).join(', ')
		},
		arcs() {
			const sum = this.segments.reduce((total, segment) => total + segment.value, 0)
			const visible = this.segments.filter(segment => segment.value > 0)
			if (!sum) {
				return []
			}
			const gap = visible.length > 1 ? GAP : 0
			let start = 0
			return visible.map(segment => {
				const sweep = segment.value / sum * 360
				const from = start + gap / 2
				const to = start + sweep - gap / 2
				start += sweep
				return { ...segment, path: this.arc(from, Math.max(from + 0.01, to)) }
			})
		},
	},
	methods: {
		/**
		 * SVG path of one segment
		 *
		 * @param {number} from Start angle
		 * @param {number} to End angle
		 * @return {string}
		 */
		arc(from, to) {
			// A full circle needs two halves
			if (to - from >= 359.99) {
				const [x1, y1] = point(0, this.radius)
				const [x2, y2] = point(180, this.radius)
				return `M ${x1} ${y1} A ${this.radius} ${this.radius} 0 1 1 ${x2} ${y2} A ${this.radius} ${this.radius} 0 1 1 ${x1} ${y1}`
			}
			const [x1, y1] = point(from, this.radius)
			const [x2, y2] = point(to, this.radius)
			const large = to - from > 180 ? 1 : 0
			return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${this.radius} ${this.radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-ring {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: center;
	gap: 16px 28px;

	&__chart {
		position: relative;
		flex: 0 0 auto;
		width: 190px;
		height: 190px;
	}

	&__svg {
		width: 100%;
		height: 100%;
	}

	&__track {
		fill: none;
		stroke: var(--tb-viz-grid);
	}

	&__arc {
		fill: none;
		cursor: default;
		transition: opacity 120ms ease;
		outline: none;

		&--active {
			opacity: .8;
		}
	}

	&__center {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		text-align: center;
	}

	&__value {
		font-size: 48px;
		font-weight: 600;
		line-height: 1.05;
	}

	&__label {
		max-width: 120px;
		color: var(--color-text-maxcontrast);
		font-size: 13px;
	}

	&__legend {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 170px;
		margin: 0;
		padding: 0;
		list-style: none;

		li {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 3px 6px;
			border-radius: 6px;
		}
	}

	&__legend-item--active {
		background-color: var(--color-background-hover);
	}

	&__swatch {
		flex: 0 0 auto;
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}

	&__legend-label {
		flex: 1 1 auto;
	}

	&__legend-value {
		font-variant-numeric: tabular-nums;
		font-weight: 600;
	}
}
</style>
