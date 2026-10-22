/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Markdown helpers for task notes (pure functions, no DOM).
 *
 * Notes are stored exactly as typed. The editor only inserts markdown syntax,
 * it never re-formats the text, so other clients (Thunderbird, phones)
 * keep seeing the same plain markdown.
 */

import DOMPurify from 'dompurify'
import MarkdownIt from 'markdown-it'
import { full as emoji } from 'markdown-it-emoji'
import Mila from 'markdown-it-link-attributes'
import Mitl from 'markdown-it-task-lists'

/** Notes longer than this are shown as plain text (same limit as upstream) */
export const MAX_RENDER_SIZE = 100_000

let renderer = null

/**
 * The markdown renderer, configured like the upstream notes view,
 * but with clickable checklist items.
 *
 * @return {MarkdownIt}
 */
export function getRenderer() {
	if (!renderer) {
		renderer = new MarkdownIt({ linkify: true, breaks: true })
			.use(emoji)
			.use(Mila, { attrs: { target: '_blank', rel: 'nofollow noopener noreferrer' } })
			.use(Mitl, { enabled: true })
	}
	return renderer
}

/**
 * Renders a note to sanitized HTML
 *
 * @param {string} text The markdown
 * @return {string} HTML
 */
export function renderNote(text) {
	return DOMPurify.sanitize(getRenderer().render(text || ''))
}

/** A checklist item at the start of a line: list marker, then [ ] or [x] and text */
const TASK_ITEM = /^((?:\s*>)*\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\](?=[ \t]+\S)/

/**
 * Finds the checklist items in source order, skipping fenced code blocks
 *
 * @param {string} text The markdown
 * @return {Array} Items: { line, checked, offset } (offset = index of the [ in the text)
 */
export function findTaskItems(text) {
	const items = []
	let offset = 0
	let fence = null
	const lines = (text || '').split('\n')
	lines.forEach((line, index) => {
		const fenceMatch = line.match(/^\s*(```|~~~)/)
		if (fenceMatch) {
			if (!fence) {
				fence = fenceMatch[1]
			} else if (fenceMatch[1] === fence) {
				fence = null
			}
		} else if (!fence) {
			const match = line.match(TASK_ITEM)
			if (match) {
				items.push({ line: index, checked: match[2] !== ' ', offset: offset + match[1].length })
			}
		}
		offset += line.length + 1
	})
	return items
}

/**
 * Counts the checklist items
 *
 * @param {string} text The markdown
 * @return {{done: number, total: number}}
 */
export function countTaskItems(text) {
	const items = findTaskItems(text)
	return { done: items.filter(item => item.checked).length, total: items.length }
}

/**
 * Checks or unchecks the n-th checklist item
 *
 * @param {string} text The markdown
 * @param {number} index Index of the item (in source order)
 * @param {boolean|null} checked New state, null = toggle
 * @return {string} The changed markdown (unchanged if the item does not exist)
 */
export function toggleTaskItem(text, index, checked = null) {
	const item = findTaskItems(text)[index]
	if (!item) {
		return text
	}
	const state = checked === null ? !item.checked : checked
	return text.slice(0, item.offset) + (state ? '[x]' : '[ ]') + text.slice(item.offset + 3)
}

/**
 * Plain-text excerpt of a note (without markdown syntax)
 *
 * @param {string} text The markdown
 * @param {number} maxLength Maximum length
 * @return {string} The excerpt
 */
export function noteExcerpt(text, maxLength = 120) {
	const plain = (text || '')
		.replace(/```[\s\S]*?```/g, ' ')
		.split('\n')
		.map(line => line
			.replace(/^\s*(?:>\s*)*/, '')
			.replace(/^#{1,6}\s+/, '')
			.replace(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, '')
			.replace(/^\|?[\s:-]+\|[\s|:-]*$/, '')
			.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/(\*\*|__|~~|\*|_|`)/g, '')
			.replace(/\|/g, ' ')
			.trim())
		.filter(line => line && !/^[-*_]{3,}$/.test(line))
		.join(' · ')
	return plain.length > maxLength ? plain.slice(0, maxLength - 1).trimEnd() + '…' : plain
}

/**
 * Line boundaries around a selection
 *
 * @param {string} text The text
 * @param {number} start Selection start
 * @param {number} end Selection end
 * @return {{lineStart: number, lineEnd: number}}
 */
function lineRange(text, start, end) {
	const lineStart = text.lastIndexOf('\n', start - 1) + 1
	let lineEnd = text.indexOf('\n', end > start && text[end - 1] === '\n' ? end - 1 : end)
	if (lineEnd === -1) {
		lineEnd = text.length
	}
	return { lineStart, lineEnd }
}

/** Line prefixes the toolbar can add or remove */
const LINE_FORMATS = {
	heading: { prefix: '## ', pattern: /^#{1,6}\s+/ },
	bullet: { prefix: '- ', pattern: /^[-*+]\s+(?!\[[ xX]\])/ },
	numbered: { prefix: null, pattern: /^\d+[.)]\s+/ },
	task: { prefix: '- [ ] ', pattern: /^[-*+]\s+\[[ xX]\]\s+/ },
	quote: { prefix: '> ', pattern: /^>\s?/ },
}

/** Inline wrappers the toolbar can add */
const INLINE_FORMATS = {
	bold: ['**', '**'],
	italic: ['*', '*'],
	strike: ['~~', '~~'],
	code: ['`', '`'],
}

/**
 * Applies a toolbar action to the text.
 * Inline formats wrap the selection (or a placeholder), line formats are toggled
 * on all selected lines.
 *
 * @param {string} text The text
 * @param {number} start Selection start
 * @param {number} end Selection end
 * @param {string} action bold, italic, strike, code, heading, bullet, numbered, task, quote, link, codeblock, table, rule
 * @param {object} placeholders Texts to insert when nothing is selected ({ text, link, column })
 * @return {{text: string, start: number, end: number}} New text and selection
 */
export function applyFormat(text, start, end, action, placeholders = {}) {
	const selected = text.slice(start, end)
	const placeholder = placeholders.text || 'Text'

	if (INLINE_FORMATS[action]) {
		const [before, after] = INLINE_FORMATS[action]
		// Remove the format if the selection is already wrapped
		if (selected && text.slice(start - before.length, start) === before && text.slice(end, end + after.length) === after) {
			return {
				text: text.slice(0, start - before.length) + selected + text.slice(end + after.length),
				start: start - before.length,
				end: end - before.length,
			}
		}
		const inner = selected || placeholder
		return {
			text: text.slice(0, start) + before + inner + after + text.slice(end),
			start: start + before.length,
			end: start + before.length + inner.length,
		}
	}

	if (action === 'link') {
		const label = selected || placeholder
		const url = placeholders.link || 'https://'
		const insert = '[' + label + '](' + url + ')'
		const urlStart = start + label.length + 3
		return { text: text.slice(0, start) + insert + text.slice(end), start: urlStart, end: urlStart + url.length }
	}

	if (action === 'codeblock' || action === 'table' || action === 'rule') {
		const blocks = {
			codeblock: '```\n' + (selected || '') + '\n```',
			table: '| ' + (placeholders.column || 'Column') + ' 1 | ' + (placeholders.column || 'Column') + ' 2 |\n| --- | --- |\n| | |',
			rule: '---',
		}
		const block = blocks[action]
		// Blocks need empty lines around them
		const before = start > 0 && text[start - 1] !== '\n' ? '\n\n' : (start > 1 && text[start - 2] !== '\n' ? '\n' : '')
		const after = end < text.length && text[end] !== '\n' ? '\n\n' : '\n'
		const insert = before + block + after
		const cursor = action === 'codeblock' ? start + before.length + 4 : start + insert.length
		return { text: text.slice(0, start) + insert + text.slice(end), start: cursor, end: action === 'codeblock' ? cursor + selected.length : cursor }
	}

	const format = LINE_FORMATS[action]
	if (!format) {
		return { text, start, end }
	}
	const { lineStart, lineEnd } = lineRange(text, start, end)
	const lines = text.slice(lineStart, lineEnd).split('\n')
	// Toggle off if every non-empty line already has this format
	const remove = lines.every(line => !line.trim() || format.pattern.test(line.replace(/^\s*/, '')))
	let number = 1
	const changed = lines.map(line => {
		const indent = line.match(/^\s*/)[0]
		let content = line.slice(indent.length)
		if (!content && lines.length > 1) {
			return line
		}
		if (remove) {
			return indent + content.replace(format.pattern, '')
		}
		// Replace other list/heading markers instead of stacking them
		for (const other of Object.values(LINE_FORMATS)) {
			content = content.replace(other.pattern, '')
		}
		const prefix = action === 'numbered' ? (number++) + '. ' : format.prefix
		return indent + prefix + content
	}).join('\n')
	const delta = changed.length - (lineEnd - lineStart)
	return {
		text: text.slice(0, lineStart) + changed + text.slice(lineEnd),
		start: lines.length === 1 ? Math.max(lineStart, start + delta) : lineStart,
		end: lines.length === 1 ? Math.max(lineStart, end + delta) : lineEnd + delta,
	}
}

/**
 * Continues a list when Enter is pressed at the end of a list item.
 * An empty item ends the list instead.
 *
 * @param {string} text The text
 * @param {number} cursor Cursor position (no selection)
 * @return {{text: string, start: number, end: number}|null} The change, or null to let the browser handle Enter
 */
export function continueList(text, cursor) {
	const lineStart = text.lastIndexOf('\n', cursor - 1) + 1
	const line = text.slice(lineStart, cursor)
	const rest = text.slice(cursor, text.indexOf('\n', cursor) === -1 ? text.length : text.indexOf('\n', cursor))
	if (rest.trim()) {
		return null
	}
	const match = line.match(/^(\s*(?:>\s*)*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?(.*)$/)
	if (!match) {
		return null
	}
	const [, prefix, marker, space, task, content] = match
	if (!content.trim()) {
		const indent = prefix.match(/^\s*/)[0]
		const quote = prefix.slice(indent.length)
		let insert
		if (!quote && indent) {
			// Empty nested item: move it one level out
			insert = indent.replace(/^(\t| {1,4})/, '') + marker + space + (task ? '[ ] ' : '')
		} else {
			// Empty item: end the list with an empty line,
			// otherwise the next line would still belong to the last item
			insert = (quote ? prefix.trimEnd() : '') + '\n' + prefix
		}
		const newText = text.slice(0, lineStart) + insert + text.slice(cursor)
		return { text: newText, start: lineStart + insert.length, end: lineStart + insert.length }
	}
	let nextMarker = marker
	const numbered = marker.match(/^(\d+)([.)])$/)
	if (numbered) {
		nextMarker = (parseInt(numbered[1]) + 1) + numbered[2]
	}
	const insert = '\n' + prefix + nextMarker + space + (task ? '[ ] ' : '')
	return { text: text.slice(0, cursor) + insert + text.slice(cursor), start: cursor + insert.length, end: cursor + insert.length }
}
