<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Header: "Create from template". Opens a dialog to choose a template, the title
and the list. The task is copied with its subtasks.
-->
<template>
	<NcButton variant="tertiary"
		class="tb-template-button"
		:aria-label="tbt('Create from template')"
		:title="tbt('Create from template')"
		@click="open = true">
		<template #icon>
			<FileDocumentPlusOutline :size="20" />
		</template>
	</NcButton>
	<NcDialog v-if="open"
		:name="tbt('Create from template')"
		:open="true"
		size="normal"
		:buttons="buttons"
		class="tb-template-dialog"
		@update:open="onOpen">
		<!-- No template list yet -->
		<div v-if="!templateCalendar" class="tb-template-dialog__empty">
			<p>{{ tbt('There is no template list yet. Create a list "Templates" and add tasks with subtasks to it – they can then be copied into any list.') }}</p>
			<NcButton variant="primary" :disabled="busy" @click="createTemplateList">
				<template #icon>
					<Plus :size="20" />
				</template>
				{{ tbt('Create list "Templates"') }}
			</NcButton>
		</div>
		<!-- Template list without templates -->
		<div v-else-if="!templates.length" class="tb-template-dialog__empty">
			<p>{{ tbt('The list "{list}" has no templates yet. Add a task with subtasks to it.', { list: templateCalendar.displayName }) }}</p>
			<NcButton variant="secondary" @click="goToTemplates">
				{{ tbt('Open "{list}"', { list: templateCalendar.displayName }) }}
			</NcButton>
		</div>
		<template v-else>
			<div class="tb-template-dialog__label" role="presentation">
				{{ tbt('Template') }}
			</div>
			<ul class="tb-template-dialog__templates" role="radiogroup" :aria-label="tbt('Template')">
				<li v-for="template in templates" :key="template.key">
					<button type="button"
						role="radio"
						:aria-checked="selected === template ? 'true' : 'false'"
						class="tb-template-dialog__template"
						:class="{ 'tb-template-dialog__template--selected': selected === template }"
						@click="select(template)">
						<span class="tb-template-dialog__template-name">{{ template.summary }}</span>
						<span class="tb-template-dialog__template-count">{{ countLabel(template) }}</span>
					</button>
				</li>
			</ul>
			<NcTextField v-model="summary"
				class="tb-template-dialog__field"
				:label="tbt('Title of the new task')"
				:disabled="!selected"
				@keydown.enter.prevent="create" />
			<label for="tb-template-target" class="tb-template-dialog__label">
				{{ tbt('Create in list') }}
			</label>
			<select id="tb-template-target" v-model="targetId" class="tb-template-dialog__select">
				<option v-for="calendar in targets" :key="calendar.id" :value="calendar.id">
					{{ calendar.displayName }}
				</option>
			</select>
			<NcButton variant="tertiary" class="tb-template-dialog__edit" @click="goToTemplates">
				{{ tbt('Edit templates') }}
			</NcButton>
		</template>
	</NcDialog>
</template>

<script>
import { tbt } from '../l10n.js'
import { templateSize, templateTasks } from '../templates.js'
import openNewTask from '../../mixins/openNewTask.js'

import { showError, showSuccess } from '@nextcloud/dialogs'
import NcButton from '@nextcloud/vue/components/NcButton'
import NcDialog from '@nextcloud/vue/components/NcDialog'
import NcTextField from '@nextcloud/vue/components/NcTextField'

import FileDocumentPlusOutline from 'vue-material-design-icons/FileDocumentPlusOutline.vue'
import Plus from 'vue-material-design-icons/Plus.vue'

export default {
	name: 'TbTemplateButton',
	components: {
		FileDocumentPlusOutline,
		NcButton,
		NcDialog,
		NcTextField,
		Plus,
	},
	mixins: [openNewTask],
	data() {
		return {
			open: false,
			selected: null,
			summary: '',
			targetId: null,
			busy: false,
		}
	},
	computed: {
		templateCalendar() {
			return this.$store.getters.tbTemplateCalendar
		},
		templates() {
			return templateTasks(this.templateCalendar)
		},
		targets() {
			return this.$store.getters.getSortedWritableCalendars
				.filter(calendar => calendar.supportsTasks !== false && calendar.id !== this.templateCalendar?.id)
		},
		target() {
			return this.targets.find(calendar => calendar.id === this.targetId) || null
		},
		buttons() {
			if (!this.templateCalendar || !this.templates.length) {
				return [{ label: tbt('Close'), callback: () => this.close() }]
			}
			return [
				{ label: tbt('Cancel'), callback: () => this.close() },
				{
					label: tbt('Create'),
					variant: 'primary',
					disabled: this.busy || !this.selected || !this.summary.trim() || !this.target,
					callback: async () => {
						await this.create()
						// The dialog closes itself after creating
						return false
					},
				},
			]
		},
	},
	watch: {
		open(open) {
			if (open) {
				this.reset()
				this.loadCompleted()
			}
		},
	},
	methods: {
		tbt,
		reset() {
			this.selected = this.templates.length === 1 ? this.templates[0] : null
			this.summary = this.selected?.summary || ''
			const preferred = this.$store.getters.tbTargetCalendar(this.$route)
			this.targetId = (this.targets.find(calendar => calendar.id === preferred?.id) || this.targets[0])?.id || null
			this.busy = false
		},
		/** Completed subtasks belong to the template too (they are copied as open tasks) */
		async loadCompleted() {
			const calendar = this.templateCalendar
			if (!calendar || calendar.loadedCompleted) {
				return
			}
			try {
				await this.$store.dispatch('getTasksFromCalendar', { calendar, completed: true, related: null })
			} catch (error) {
				console.error('Could not load the completed tasks of the template list', error)
			}
		},
		select(template) {
			// Keep a title the user typed
			if (!this.summary.trim() || this.summary === this.selected?.summary) {
				this.summary = template.summary
			}
			this.selected = template
		},
		countLabel(template) {
			const count = templateSize(template)
			return count === 1 ? tbt('1 task') : tbt('{count} tasks', { count })
		},
		close() {
			this.open = false
		},
		onOpen(open) {
			if (!open) {
				this.close()
			}
		},
		async create() {
			if (this.busy || !this.selected || !this.summary.trim() || !this.target) {
				return
			}
			this.busy = true
			const target = this.target
			const result = await this.$store.dispatch('createFromTemplate', {
				template: this.selected,
				calendar: target,
				summary: this.summary,
			})
			this.busy = false
			if (result.error === 'private') {
				showError(tbt('Private tasks cannot be copied into lists shared with you.'))
				return
			}
			if (result.error) {
				showError(tbt('The task could not be created completely.'))
			}
			if (!result.task) {
				return
			}
			this.close()
			if (!result.error) {
				showSuccess(tbt('"{task}" created in "{list}" ({count} tasks).', { task: result.task.summary, list: target.displayName, count: result.count }))
			}
			const calendarId = this.$route.params.calendarId
			if (calendarId && calendarId !== target.id) {
				await this.$router.push({ name: 'calendarsTask', params: { calendarId: target.id, taskId: result.task.uri } })
			} else {
				await this.openNewTask(result.task)
			}
		},
		async createTemplateList() {
			this.busy = true
			try {
				const calendar = await this.$store.dispatch('createTbTemplateList')
				if (calendar) {
					this.close()
					await this.$router.push({ name: 'calendars', params: { calendarId: calendar.id } })
				}
			} catch (error) {
				console.error(error)
				showError(tbt('Could not create the list.'))
			} finally {
				this.busy = false
			}
		},
		async goToTemplates() {
			const id = this.templateCalendar?.id
			this.close()
			if (id && this.$route.params.calendarId !== id) {
				await this.$router.push({ name: 'calendars', params: { calendarId: id } })
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-template-button {
	flex: 0 0 auto;
}

.tb-template-dialog {
	&__empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: calc(2 * var(--default-grid-baseline));
		padding-bottom: var(--default-grid-baseline);
	}

	&__label {
		display: block;
		margin: calc(2 * var(--default-grid-baseline)) 0 4px;
		font-weight: 600;
	}

	&__templates {
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 260px;
		overflow-y: auto;
		margin: 0 0 calc(3 * var(--default-grid-baseline));
		padding: 2px;
		list-style: none;
	}

	&__template {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: var(--default-clickable-area);
		margin: 0;
		padding: 6px 12px;
		border: 1px solid var(--color-border);
		border-radius: var(--tb-radius, 10px);
		background: var(--tb-card-bg, var(--color-main-background));
		color: var(--color-main-text);
		text-align: start;
		font-weight: normal;
		cursor: pointer;

		&:hover,
		&:focus-visible {
			border-color: var(--color-border-dark);
			background: var(--color-background-hover);
		}

		&--selected,
		&--selected:hover {
			border-color: var(--color-primary-element);
			box-shadow: 0 0 0 1px var(--color-primary-element);
		}
	}

	&__template-name {
		flex: 1 1 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-weight: 500;
	}

	&__template-count {
		flex: 0 0 auto;
		color: var(--color-text-maxcontrast);
		font-size: 12px;
	}

	&__select {
		width: 100%;
		margin: 0;
	}

	&__edit {
		margin-top: calc(2 * var(--default-grid-baseline));
	}
}
</style>
