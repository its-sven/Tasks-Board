<!--
SPDX-FileCopyrightText: 2026 Sven Würth
SPDX-License-Identifier: AGPL-3.0-or-later
-->

<!--
Replaces the upstream NotesItem in the sidebar:
- view: rendered markdown, checklist items can be checked directly
- edit: markdown source with toolbar, shortcuts, list continuation and preview
The note is saved exactly as typed (plain markdown).
-->
<template>
	<div v-click-outside="[onClickOutside, { ignore: ['.v-popper__popper'] }]" class="tb-notes">
		<div v-if="!editing"
			class="tb-notes__viewer tb-note"
			:class="{ 'tb-notes__viewer--empty': !hasContent, 'tb-notes__viewer--editable': !readOnly }"
			:title="readOnly ? '' : tbt('Click to edit')"
			@click="onViewerClick">
			<!-- eslint-disable-next-line vue/no-v-html -- sanitized by DOMPurify in renderNote() -->
			<div v-if="hasContent" v-html="html" />
			<span v-else>{{ t('tasks', 'Click here to add a note.') }}</span>
		</div>

		<div v-else class="tb-notes__editor">
			<div class="tb-notes__toolbar" role="toolbar" :aria-label="tbt('Formatting')">
				<NcButton v-for="tool in mainTools"
					:key="tool.action"
					variant="tertiary"
					size="small"
					:aria-label="tool.label"
					:title="tool.label + (tool.shortcut ? ' (' + tool.shortcut + ')' : '')"
					@mousedown.prevent
					@click="format(tool.action)">
					<template #icon>
						<component :is="tool.icon" :size="18" />
					</template>
				</NcButton>
				<NcActions class="tb-notes__more"
					variant="tertiary"
					:aria-label="tbt('More formatting')"
					:title="tbt('More formatting')">
					<NcActionButton v-for="tool in moreTools"
						:key="tool.action"
						:close-after-click="true"
						@click="format(tool.action)">
						<template #icon>
							<component :is="tool.icon" :size="18" />
						</template>
						{{ tool.label }}
					</NcActionButton>
				</NcActions>
				<span class="tb-notes__spacer" />
				<NcButton variant="tertiary"
					size="small"
					:pressed="preview"
					:aria-label="tbt('Preview')"
					:title="tbt('Preview')"
					@mousedown.prevent
					@click="preview = !preview">
					<template #icon>
						<EyeOutline :size="18" />
					</template>
				</NcButton>
				<NcButton variant="primary"
					size="small"
					:aria-label="tbt('Finish editing')"
					:title="tbt('Finish editing') + ' (Ctrl+Enter)'"
					@click="finish(true)">
					<template #icon>
						<Check :size="18" />
					</template>
				</NcButton>
			</div>
			<textarea ref="textarea"
				v-model="draft"
				class="tb-notes__textarea"
				:maxlength="100000"
				:aria-label="t('tasks', 'Notes')"
				@input="autoGrow"
				@keydown="onKeydown"
				@compositionstart="compositing = true"
				@compositionend="compositing = false" />
			<!-- eslint-disable-next-line vue/no-v-html -- sanitized by DOMPurify in renderNote() -->
			<div v-if="preview" class="tb-notes__preview tb-note" v-html="previewHtml" />
			<p class="tb-notes__hint">
				{{ tbt('Markdown · Ctrl+Enter or click outside saves') }}
			</p>
		</div>
	</div>
</template>

<script>
import { applyFormat, continueList, MAX_RENDER_SIZE, renderNote, toggleTaskItem } from '../markdown.js'
import { tbt } from '../l10n.js'

import { translate as t } from '@nextcloud/l10n'
import { subscribe, unsubscribe } from '@nextcloud/event-bus'
import NcActionButton from '@nextcloud/vue/components/NcActionButton'
import NcActions from '@nextcloud/vue/components/NcActions'
import NcButton from '@nextcloud/vue/components/NcButton'
import { vOnClickOutside as ClickOutside } from '@vueuse/components'

import Check from 'vue-material-design-icons/Check.vue'
import CodeBraces from 'vue-material-design-icons/CodeBraces.vue'
import CodeTags from 'vue-material-design-icons/CodeTags.vue'
import EyeOutline from 'vue-material-design-icons/EyeOutline.vue'
import FormatBold from 'vue-material-design-icons/FormatBold.vue'
import FormatHeaderPound from 'vue-material-design-icons/FormatHeaderPound.vue'
import FormatItalic from 'vue-material-design-icons/FormatItalic.vue'
import FormatListBulleted from 'vue-material-design-icons/FormatListBulleted.vue'
import FormatListChecks from 'vue-material-design-icons/FormatListChecks.vue'
import FormatListNumbered from 'vue-material-design-icons/FormatListNumbered.vue'
import FormatQuoteClose from 'vue-material-design-icons/FormatQuoteClose.vue'
import FormatStrikethroughVariant from 'vue-material-design-icons/FormatStrikethroughVariant.vue'
import LinkVariant from 'vue-material-design-icons/LinkVariant.vue'
import Minus from 'vue-material-design-icons/Minus.vue'
import TableLarge from 'vue-material-design-icons/TableLarge.vue'

/**
 * @param {string} text Plain text
 * @return {string} HTML-escaped text
 */
function escapeHtml(text) {
	return text.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
}

export default {
	name: 'TbNotesItem',
	components: {
		Check,
		CodeBraces,
		CodeTags,
		EyeOutline,
		FormatBold,
		FormatHeaderPound,
		FormatItalic,
		FormatListBulleted,
		FormatListChecks,
		FormatListNumbered,
		FormatQuoteClose,
		FormatStrikethroughVariant,
		LinkVariant,
		Minus,
		NcActionButton,
		NcActions,
		NcButton,
		TableLarge,
	},
	directives: {
		ClickOutside,
	},
	props: {
		value: {
			type: String,
			default: '',
		},
		readOnly: {
			type: Boolean,
			default: false,
		},
		task: {
			type: Object,
			required: true,
		},
	},
	emits: ['setValue', 'editing'],
	data() {
		return {
			editing: false,
			draft: '',
			original: '',
			preview: false,
			compositing: false,
		}
	},
	computed: {
		hasContent() {
			return !!(this.value || '').trim()
		},
		html() {
			return this.toHtml(this.value, this.readOnly)
		},
		previewHtml() {
			return this.toHtml(this.draft, true)
		},
		mainTools() {
			return this.tools.filter(tool => tool.main)
		},
		moreTools() {
			return this.tools.filter(tool => !tool.main)
		},
		tools() {
			return [
				{ main: true, action: 'bold', icon: 'FormatBold', label: tbt('Bold'), shortcut: 'Ctrl+B' },
				{ main: true, action: 'italic', icon: 'FormatItalic', label: tbt('Italic'), shortcut: 'Ctrl+I' },
				{ action: 'strike', icon: 'FormatStrikethroughVariant', label: tbt('Strikethrough') },
				{ main: true, action: 'heading', icon: 'FormatHeaderPound', label: tbt('Heading') },
				{ main: true, action: 'bullet', icon: 'FormatListBulleted', label: tbt('Bulleted list') },
				{ action: 'numbered', icon: 'FormatListNumbered', label: tbt('Numbered list') },
				{ main: true, action: 'task', icon: 'FormatListChecks', label: tbt('Checklist') },
				{ action: 'quote', icon: 'FormatQuoteClose', label: tbt('Quote') },
				{ main: true, action: 'code', icon: 'CodeTags', label: tbt('Code') },
				{ action: 'codeblock', icon: 'CodeBraces', label: tbt('Code block') },
				{ main: true, action: 'link', icon: 'LinkVariant', label: tbt('Link'), shortcut: 'Ctrl+K' },
				{ action: 'table', icon: 'TableLarge', label: tbt('Table') },
				{ action: 'rule', icon: 'Minus', label: tbt('Horizontal line') },
			]
		},
	},
	watch: {
		/**
		 * Save the draft of the previous task before showing another one
		 *
		 * @param {object} newTask The task now shown
		 * @param {object} oldTask The task shown before
		 */
		task(newTask, oldTask) {
			if (this.editing) {
				this.save(oldTask)
				this.editing = false
				this.$emit('editing', false)
			}
		},
	},
	mounted() {
		// Double click on the note icon of a task row opens the editor
		subscribe('tasks:edit-appsidebar-notes', this.onEditRequest)
	},
	beforeUnmount() {
		unsubscribe('tasks:edit-appsidebar-notes', this.onEditRequest)
		if (this.editing) {
			this.save(this.task)
		}
	},
	methods: {
		t,
		tbt,
		toHtml(text, disableCheckboxes) {
			text = text || ''
			if (text.length > MAX_RENDER_SIZE) {
				return '<p>' + escapeHtml(text.slice(0, MAX_RENDER_SIZE)) + '</p>'
			}
			let html = renderNote(text)
			if (disableCheckboxes) {
				html = html.replace(/<input class="task-list-item-checkbox"/g, '<input disabled="" class="task-list-item-checkbox"')
			}
			return html
		},
		onViewerClick($event) {
			const target = $event.target
			if (target.matches?.('input.task-list-item-checkbox')) {
				$event.preventDefault()
				$event.stopPropagation()
				if (this.readOnly) {
					return
				}
				const boxes = [...$event.currentTarget.querySelectorAll('input.task-list-item-checkbox')]
				const index = boxes.indexOf(target)
				const changed = toggleTaskItem(this.value, index)
				if (changed !== this.value) {
					this.$emit('setValue', { task: this.task, value: changed })
				}
				return
			}
			if (target.closest('a') || this.readOnly) {
				return
			}
			this.startEditing()
		},
		onEditRequest() {
			if (!this.readOnly && !this.editing) {
				this.startEditing()
			}
		},
		async startEditing() {
			this.draft = this.value || ''
			this.original = this.draft
			this.editing = true
			this.$emit('editing', true)
			await this.$nextTick()
			this.$refs.textarea?.focus()
			this.autoGrow()
		},
		save(task) {
			if (this.draft !== this.original) {
				this.$emit('setValue', { task, value: this.draft })
			}
		},
		finish(saveDraft) {
			if (!this.editing) {
				return
			}
			if (saveDraft) {
				this.save(this.task)
			}
			this.editing = false
			this.$emit('editing', false)
		},
		onClickOutside() {
			this.finish(true)
		},
		autoGrow() {
			const textarea = this.$refs.textarea
			if (!textarea) {
				return
			}
			textarea.style.height = 'auto'
			textarea.style.height = Math.max(textarea.scrollHeight, 160) + 'px'
		},
		async replace({ text, start, end }) {
			this.draft = text
			await this.$nextTick()
			const textarea = this.$refs.textarea
			if (textarea) {
				textarea.focus()
				textarea.setSelectionRange(start, end)
			}
			this.autoGrow()
		},
		format(action) {
			const textarea = this.$refs.textarea
			const start = textarea ? textarea.selectionStart : this.draft.length
			const end = textarea ? textarea.selectionEnd : this.draft.length
			this.replace(applyFormat(this.draft, start, end, action, { text: tbt('Text'), column: tbt('Column') }))
		},
		onKeydown($event) {
			if (this.compositing || $event.isComposing) {
				return
			}
			const mod = $event.ctrlKey || $event.metaKey
			if ($event.key === 'Enter' && mod) {
				$event.preventDefault()
				this.finish(true)
				return
			}
			if ($event.key === 'Escape') {
				// Escape closes the editor and keeps the text
				$event.preventDefault()
				$event.stopPropagation()
				this.finish(true)
				return
			}
			if (mod && !$event.shiftKey && !$event.altKey) {
				const shortcut = { b: 'bold', i: 'italic', k: 'link' }[$event.key.toLowerCase()]
				if (shortcut) {
					$event.preventDefault()
					this.format(shortcut)
					return
				}
			}
			if ($event.key === 'Enter' && !$event.shiftKey && !mod && !$event.altKey) {
				const textarea = this.$refs.textarea
				if (textarea.selectionStart !== textarea.selectionEnd) {
					return
				}
				const change = continueList(this.draft, textarea.selectionStart)
				if (change) {
					$event.preventDefault()
					this.replace(change)
				}
			}
		},
	},
}
</script>

<style lang="scss" scoped>
.tb-notes {
	width: 100%;
	padding: 4px 0 8px;
	font-size: var(--default-font-size);

	&__viewer {
		min-height: 64px;
		padding: 8px 10px;
		border-radius: var(--tb-radius, 10px);
		border: 1px solid transparent;
		transition: border-color 120ms ease, background-color 120ms ease;

		&--editable {
			cursor: text;

			&:hover {
				border-color: var(--color-border);
				background-color: var(--color-background-hover);
			}
		}

		&--empty {
			display: flex;
			align-items: center;
			color: var(--color-text-maxcontrast);
			border: 1px dashed var(--color-border-dark);
		}
	}

	&__editor {
		border: 1px solid var(--color-border-dark);
		border-radius: var(--tb-radius, 10px);
		overflow: hidden;

		&:focus-within {
			border-color: var(--color-primary-element);
			box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary-element) 15%, transparent);
		}
	}

	&__toolbar {
		display: flex;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0;
		position: sticky;
		top: 0;
		z-index: 1;
		background-color: var(--color-background-hover);
		padding: 2px 4px;
		border-bottom: 1px solid var(--color-border);
		overflow-x: auto;
		scrollbar-width: none;
	}

	&__spacer {
		flex-grow: 1;
	}

	&__textarea {
		display: block;
		width: 100%;
		min-height: 160px;
		margin: 0;
		resize: vertical;
		font-family: var(--font-face-monospace, monospace);
		font-size: 13px;
		line-height: 1.6;
		padding: 8px 10px;
		overflow: hidden;
		border: none !important;
		border-radius: 0 !important;
		box-shadow: none !important;
		background-color: var(--color-main-background);
	}

	&__preview {
		padding: 8px 10px;
		border-top: 1px dashed var(--color-border-dark);
	}

	&__hint {
		color: var(--color-text-maxcontrast);
		font-size: 11px;
		margin: 0;
		padding: 2px 10px 4px;
		background-color: var(--color-background-hover);
		border-top: 1px solid var(--color-border);
	}
}

</style>

<style lang="scss">
// Rendered markdown (based on the upstream notes view)
.tb-note {
	* {
		white-space: normal;
		word-wrap: break-word;
		overflow-wrap: break-word;
	}

	a {
		color: var(--color-primary-element);
		text-decoration: underline;
	}

	p {
		margin-bottom: 12px;
	}

	s,
	del {
		text-decoration: line-through;
	}

	em {
		font-style: italic;
	}

	strong {
		font-weight: bold;
	}

	ol,
	ul {
		margin-left: 22px;
		margin-bottom: 10px;
	}

	ul {
		list-style-type: disc;

		&.contains-task-list {
			list-style-type: none;
			margin-left: 4px;
		}
	}

	ol {
		list-style-type: decimal;
	}

	// Checkbox in the text line, wrapped lines start below the text (hanging indent).
	// The sizes override the global Nextcloud input styles.
	li.task-list-item {
		display: list-item;
		list-style: none;
		padding-left: 22px;
		text-indent: -22px;
		margin: 2px 0;

		> p {
			margin-bottom: 4px;
		}

		input.task-list-item-checkbox {
			display: inline-block;
			width: 16px;
			height: 16px;
			min-height: 0;
			min-width: 0;
			margin: 0 6px 0 0;
			padding: 0;
			vertical-align: -3px;
			text-indent: 0;
			cursor: pointer;
			accent-color: var(--color-primary-element);

			&:disabled {
				cursor: default;
			}
		}

		ul,
		ol {
			text-indent: 0;
		}
	}

	h1 {
		font-size: 18px;
		font-weight: 600;
		margin: 12px 0 6px;
	}

	h2 {
		font-size: 16px;
		font-weight: 600;
		margin: 10px 0 6px;
	}

	h3,
	h4,
	h5,
	h6 {
		font-size: 14px;
		font-weight: 600;
		margin: 8px 0 4px;
	}

	code {
		font-family: var(--font-face-monospace, monospace);
		background-color: var(--color-background-dark);
		border-radius: 3px;
		padding: 0 3px;
	}

	pre {
		background-color: var(--color-background-dark);
		border-radius: var(--border-radius);
		padding: 6px 8px;
		overflow: auto;
		margin-bottom: 10px;

		code {
			white-space: pre;
			padding: 0;
		}
	}

	img {
		max-width: 100%;
		max-height: 50vh;
		margin: auto;
		display: block;
	}

	table {
		margin-bottom: 10px;
		border-collapse: collapse;

		thead {
			background-color: var(--color-background-dark);
		}

		td,
		th {
			border: 1px solid var(--color-border-dark);
			padding: 3px 6px;
		}
	}

	blockquote {
		padding: 4px 12px;
		margin: 0 0 12px;
		color: var(--color-text-maxcontrast);
		border-left: 4px solid var(--color-border-dark);
	}

	hr {
		border: 0;
		border-top: 1px solid var(--color-border-dark);
		margin: 12px 0;
	}
}
</style>
