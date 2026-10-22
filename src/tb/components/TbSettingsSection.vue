<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<template>
	<div class="tb-settings">
		<h3 class="tb-settings__headline">
			{{ tbt('Extra features') }}
		</h3>
		<NcCheckboxRadioSwitch type="switch"
			:model-value="prefs.autoProgress"
			@update:model-value="set({ autoProgress: $event })">
			{{ tbt('Calculate the progress of main tasks from their subtasks') }}
		</NcCheckboxRadioSwitch>
		<p class="tb-settings__hint">
			{{ tbt('Cancelled subtasks do not count. When all subtasks are done, the main task shows 99 % and stays open until you check it off.') }}
		</p>
		<NcCheckboxRadioSwitch type="switch"
			:model-value="prefs.inheritFromParent"
			@update:model-value="set({ inheritFromParent: $event })">
			{{ tbt('New subtasks take over priority, tags and assigned person of the main task') }}
		</NcCheckboxRadioSwitch>

		<NcButton variant="tertiary" class="tb-settings__shortcuts" @click="showShortcuts">
			<template #icon>
				<KeyboardOutline :size="20" />
			</template>
			{{ tbt('Show the keyboard shortcuts') }}
		</NcButton>

		<h3 class="tb-settings__headline tb-settings__headline--spaced">
			{{ tbt('Notifications') }}
		</h3>
		<NcCheckboxRadioSwitch type="switch"
			:model-value="prefs.notifyAssigned"
			@update:model-value="set({ notifyAssigned: $event })">
			{{ tbt('When someone assigns a task to me') }}
		</NcCheckboxRadioSwitch>
		<NcCheckboxRadioSwitch type="switch"
			:model-value="prefs.notifyCompleted"
			@update:model-value="set({ notifyCompleted: $event })">
			{{ tbt('When someone completes a task I assigned') }}
		</NcCheckboxRadioSwitch>
		<NcCheckboxRadioSwitch type="switch"
			:model-value="prefs.notifyFollowUp"
			@update:model-value="set({ notifyFollowUp: $event })">
			{{ tbt('When a follow-up date is reached') }}
		</NcCheckboxRadioSwitch>
		<NcCheckboxRadioSwitch type="switch"
			:model-value="prefs.notifyDue"
			@update:model-value="set({ notifyDue: $event })">
			{{ tbt('When a task is due today') }}
		</NcCheckboxRadioSwitch>
		<p class="tb-settings__hint">
			{{ tbt('Goes to the assigned person, or to the owner of the list if nobody is assigned.') }}
		</p>
		<p class="tb-settings__hint">
			{{ tbt('The notifications appear at the bell at the top right. Whether you also get an e-mail is set in your personal Nextcloud settings under Notifications.') }}
		</p>

		<h3 class="tb-settings__headline tb-settings__headline--spaced">
			{{ tbt('Templates') }}
		</h3>
		<label for="tb-template-list" class="tb-settings__label">
			{{ tbt('Template list') }}
		</label>
		<select id="tb-template-list"
			class="tb-settings__select"
			:value="prefs.templateCalendarId || ''"
			@change="set({ templateCalendarId: $event.target.value })">
			<option value="">
				{{ autoTemplateLabel }}
			</option>
			<option value="none">
				{{ tbt('No template list') }}
			</option>
			<option v-for="calendar in calendars"
				:key="calendar.id"
				:value="calendar.id">
				{{ calendar.displayName }}
			</option>
		</select>
		<p class="tb-settings__hint tb-settings__hint--flat">
			{{ tbt('Tasks of this list are templates: they do not appear in the collections, and "Create from template" copies them with their subtasks into another list.') }}
		</p>

		<h3 class="tb-settings__headline tb-settings__headline--spaced">
			{{ tbt('Tag list') }}
		</h3>
		<p class="tb-settings__hint tb-settings__hint--flat">
			{{ canEditTags
				? tbt('These tags are suggested first to everyone. Other tags are still allowed and are marked as "not in the tag list".')
				: tbt('These tags are suggested first. Administrators can change the list.') }}
		</p>
		<ul v-if="tagList.length" class="tb-settings__tags">
			<li v-for="tag in tagList" :key="tag" class="tb-settings__tag">
				<span>{{ tag }}</span>
				<button v-if="canEditTags"
					type="button"
					class="tb-settings__tag-remove"
					:aria-label="tbt('Remove {tag}', { tag })"
					:title="tbt('Remove {tag}', { tag })"
					@click="removeTag(tag)">
					<Close :size="14" />
				</button>
			</li>
		</ul>
		<p v-else class="tb-settings__hint tb-settings__hint--flat">
			{{ tbt('No tag list yet: all tags in use are suggested.') }}
		</p>
		<div v-if="canEditTags" class="tb-settings__tag-add">
			<input v-model="newTag"
				type="text"
				:placeholder="tbt('New tag')"
				:aria-label="tbt('New tag')"
				maxlength="100"
				@keydown.enter.prevent="addTag">
			<NcButton variant="secondary" :disabled="!newTag.trim()" @click="addTag">
				{{ tbt('Add') }}
			</NcButton>
			<NcButton v-if="missingUsedTags.length"
				variant="tertiary"
				@click="addUsedTags">
				{{ tbt('Take over tags in use ({count})', { count: missingUsedTags.length }) }}
			</NcButton>
		</div>

		<h3 class="tb-settings__headline tb-settings__headline--spaced">
			{{ tbt('Waiting tag') }}
		</h3>
		<p class="tb-settings__hint tb-settings__hint--flat">
			{{ tbt('Tasks with this tag are waiting: they appear under "Waiting" and in the board column "Waiting". The start date is the follow-up date.') }}
		</p>
		<div v-if="canEditTags" class="tb-settings__waiting">
			<input v-model="waitingTagInput"
				type="text"
				:placeholder="waitingTagDefault"
				:aria-label="tbt('Waiting tag')"
				maxlength="100"
				@keydown.enter.prevent="saveWaitingTag(waitingTagInput)">
			<NcButton variant="secondary" :disabled="!waitingTagChanged" @click="saveWaitingTag(waitingTagInput)">
				{{ tbt('Save') }}
			</NcButton>
			<NcButton v-if="waitingTag !== waitingTagDefault"
				variant="tertiary"
				@click="saveWaitingTag('')">
				{{ tbt('Back to "{tag}"', { tag: waitingTagDefault }) }}
			</NcButton>
		</div>
		<ul v-else class="tb-settings__tags">
			<li class="tb-settings__tag tb-settings__tag--single">
				<span>{{ waitingTag }}</span>
			</li>
		</ul>
		<p class="tb-settings__hint tb-settings__hint--flat">
			{{ canEditTags
				? tbt('Applies to everyone. Tasks that still have the old tag are no longer treated as waiting.')
				: tbt('Administrators can change the waiting tag.') }}
		</p>
	</div>
</template>

<script>
import { tbt } from '../l10n.js'
import { isManagedTag } from '../taglist.js'
import { resolveTemplateCalendar } from '../templates.js'
import { isWaitingTagName, normalizeWaitingTag } from '../waiting.js'

import { showError } from '@nextcloud/dialogs'
import { emit } from '@nextcloud/event-bus'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcCheckboxRadioSwitch from '@nextcloud/vue/components/NcCheckboxRadioSwitch'

import Close from 'vue-material-design-icons/Close.vue'
import KeyboardOutline from 'vue-material-design-icons/KeyboardOutline.vue'

export default {
	name: 'TbSettingsSection',
	components: {
		Close,
		KeyboardOutline,
		NcButton,
		NcCheckboxRadioSwitch,
	},
	data() {
		return {
			newTag: '',
			waitingTagInput: this.$store.getters.tbWaitingTag,
		}
	},
	computed: {
		prefs() {
			return this.$store.getters.tbPrefs
		},
		calendars() {
			return this.$store.getters.getSortedCalendars.filter(calendar => calendar.supportsTasks !== false)
		},
		autoTemplateLabel() {
			const found = resolveTemplateCalendar('', this.calendars)
			return found
				? tbt('Automatic: list "{list}"', { list: found.displayName })
				: tbt('Automatic: a list named "Templates"')
		},
		tagList() {
			return this.$store.getters.tbTagList
		},
		canEditTags() {
			return this.$store.getters.tbCanEditTagList
		},
		waitingTag() {
			return this.$store.getters.tbWaitingTag
		},
		waitingTagDefault() {
			return this.$store.getters.tbWaitingTagDefault
		},
		waitingTagChanged() {
			const tag = normalizeWaitingTag(this.waitingTagInput)
			return !!tag && tag !== this.waitingTag
		},
		missingUsedTags() {
			return (this.$store.getters.tags || []).filter(tag => !isManagedTag(tag, this.tagList) && !isWaitingTagName(tag))
		},
	},
	methods: {
		tbt,
		set(patch) {
			this.$store.dispatch('setTbPrefs', patch)
		},
		showShortcuts() {
			emit('tasks_board:show-shortcuts')
		},
		async saveTags(list) {
			try {
				await this.$store.dispatch('saveTbTagList', list)
			} catch {
				showError(tbt('Could not save the tag list.'))
			}
		},
		addTag() {
			const tag = this.newTag.trim()
			if (!tag) {
				return
			}
			this.newTag = ''
			if (!isManagedTag(tag, this.tagList)) {
				this.saveTags([...this.tagList, tag])
			}
		},
		removeTag(tag) {
			this.saveTags(this.tagList.filter(entry => entry !== tag))
		},
		addUsedTags() {
			this.saveTags([...this.tagList, ...this.missingUsedTags])
		},
		async saveWaitingTag(tag) {
			if (tag && !normalizeWaitingTag(tag)) {
				return
			}
			try {
				this.waitingTagInput = await this.$store.dispatch('saveTbWaitingTag', tag)
			} catch {
				this.waitingTagInput = this.waitingTag
				showError(tbt('Could not save the waiting tag.'))
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-settings {
	margin-top: calc(4 * var(--default-grid-baseline));

	&__headline {
		font-size: var(--default-font-size, 15px);
		font-weight: 600;
		margin: 0 0 var(--default-grid-baseline);

		&--spaced {
			margin-top: calc(3 * var(--default-grid-baseline));
		}
	}

	&__hint {
		color: var(--color-text-maxcontrast);
		font-size: var(--font-size-small, 13px);
		margin: 0 0 calc(2 * var(--default-grid-baseline)) calc(var(--default-clickable-area) + var(--default-grid-baseline));

		&--flat {
			margin-left: 0;
		}
	}

	&__label {
		display: block;
		font-weight: 500;
		margin-bottom: 2px;
	}

	&__select {
		width: 100%;
		max-width: 360px;
		margin-bottom: var(--default-grid-baseline);
	}

	&__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0 0 calc(2 * var(--default-grid-baseline));
		padding: 0;
		list-style: none;
	}

	&__tag {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		padding: 2px 6px 2px 10px;
		border: 1px solid var(--color-border);
		border-radius: 999px;
		background: var(--color-background-hover);
		font-size: 13px;

		&--single {
			padding-right: 10px;
		}
	}

	&__tag-remove {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 20px;
		height: 20px;
		min-height: 20px;
		margin: 0;
		padding: 0;
		border: none;
		border-radius: 50%;
		background: transparent;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			background: var(--color-background-dark);
		}
	}

	&__tag-add,
	&__waiting {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--default-grid-baseline);

		input {
			flex: 1 1 160px;
			min-width: 0;
			margin: 0;
		}
	}
}
</style>
