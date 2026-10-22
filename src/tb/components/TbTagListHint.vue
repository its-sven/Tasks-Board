<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Sidebar: hint for tags that are not in the fixed tag list.
Administrators can add them to the list directly.
-->
<template>
	<div v-if="unknown.length" class="tb-taghint">
		<InformationOutline :size="16" class="tb-taghint__icon" />
		<span class="tb-taghint__text">
			{{ tbt('Not in the tag list: {tags}', { tags: unknown.map(tag => '„' + tag + '“').join(', ') }) }}
		</span>
		<NcButton v-if="canEdit && !readOnly"
			size="small"
			variant="tertiary"
			class="tb-taghint__add"
			@click="addToList">
			{{ tbt('Add to the list') }}
		</NcButton>
	</div>
</template>

<script>
import { tbt } from '../l10n.js'
import { unknownTags } from '../taglist.js'

import { showError, showSuccess } from '@nextcloud/dialogs'
import NcButton from '@nextcloud/vue/components/NcButton'

import InformationOutline from 'vue-material-design-icons/InformationOutline.vue'

export default {
	name: 'TbTagListHint',
	components: {
		InformationOutline,
		NcButton,
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
		unknown() {
			return unknownTags(this.task.tags, this.$store.getters.tbTagList)
		},
		canEdit() {
			return this.$store.getters.tbCanEditTagList
		},
	},
	methods: {
		tbt,
		async addToList() {
			const tags = [...this.unknown]
			try {
				await this.$store.dispatch('saveTbTagList', [...this.$store.getters.tbTagList, ...tags])
				showSuccess(tbt('Added to the tag list: {tags}', { tags: tags.join(', ') }))
			} catch {
				showError(tbt('Could not save the tag list.'))
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-taghint {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 4px 6px;
	margin: 2px 6px 4px calc(var(--default-clickable-area) + 6px);
	color: var(--color-text-maxcontrast);
	font-size: 12px;
	line-height: 1.4;

	&__icon {
		flex: 0 0 auto;
	}

	&__text {
		flex: 1 1 auto;
		min-width: 0;
	}

	&__add {
		flex: 0 0 auto;
	}
}
</style>
