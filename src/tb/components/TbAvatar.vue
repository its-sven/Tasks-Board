<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Small avatar of the assigned person (list rows, cards, board rows)
-->
<template>
	<span v-if="person"
		class="tb-avatar"
		:title="title">
		<NcAvatar :user="person.uid"
			:display-name="person.displayName"
			:size="size"
			:disable-menu="true"
			:disable-tooltip="true"
			:hide-status="true" />
		<span v-if="showName" class="tb-avatar__name">{{ person.displayName }}</span>
	</span>
</template>

<script>
import { tbt } from '../l10n.js'

import NcAvatar from '@nextcloud/vue/components/NcAvatar'

export default {
	name: 'TbAvatar',
	components: {
		NcAvatar,
	},
	props: {
		/** { uid, displayName } or null */
		person: {
			type: Object,
			default: null,
		},
		size: {
			type: Number,
			default: 20,
		},
		showName: {
			type: Boolean,
			default: false,
		},
	},
	computed: {
		title() {
			return tbt('Assigned to {name}', { name: this.person.displayName })
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-avatar {
	display: inline-flex;
	align-items: center;
	gap: 6px;
	flex-shrink: 0;
	min-width: 0;

	&__name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
}
</style>
