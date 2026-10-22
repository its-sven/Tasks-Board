import { applyFormat, continueList, countTaskItems, findTaskItems, getRenderer, noteExcerpt, renderNote, toggleTaskItem } from '../../../../src/tb/markdown.js'

import { describe, expect, it } from 'vitest'

const NOTE = [
	'## Ablauf',
	'- [x] Konto anlegen',
	'- [ ] Mail einrichten',
	'```',
	'- [ ] kein Eintrag (Code)',
	'```',
	'1. [ ] Laptop übergeben',
	'> - [X] im Zitat',
	'- [ ]',
].join('\n')

describe('markdown - checklists', () => {
	it('finds items in source order, ignores code and empty items', () => {
		expect(findTaskItems(NOTE).map(item => [item.line, item.checked])).toEqual([[1, true], [2, false], [6, false], [7, true]])
		expect(countTaskItems(NOTE)).toEqual({ done: 2, total: 4 })
	})

	it('toggles exactly one item and keeps everything else', () => {
		const changed = toggleTaskItem(NOTE, 2)
		expect(changed.split('\n')[6]).toBe('1. [x] Laptop übergeben')
		expect(changed.split('\n').filter((line, i) => i !== 6)).toEqual(NOTE.split('\n').filter((line, i) => i !== 6))
		expect(toggleTaskItem(NOTE, 0).split('\n')[1]).toBe('- [ ] Konto anlegen')
		expect(toggleTaskItem(NOTE, 9)).toBe(NOTE)
	})

	it('renders checkboxes in the same order as the source', () => {
		const html = renderNote(NOTE)
		const boxes = html.match(/<input[^>]*task-list-item-checkbox[^>]*>/g)
		expect(boxes).toHaveLength(4)
		expect(boxes.map(box => box.includes('checked'))).toEqual([true, false, false, true])
		expect(html).not.toContain('disabled')
	})

	it('keeps line breaks like the upstream view and sanitizes', () => {
		expect(renderNote('Zeile 1\nZeile 2')).toContain('<br>')
		// Raw HTML is shown as text, never rendered
		expect(renderNote('<img src=x onerror=alert(1)>')).not.toContain('<img')
		expect(renderNote('[x](javascript:alert(1))')).not.toContain('href="javascript')
	})
})

describe('markdown - excerpt', () => {
	it('strips markdown syntax', () => {
		expect(noteExcerpt('## Titel\n- [ ] **Wichtig** mit [Link](https://x)\n\n---\n`code`')).toBe('Titel · Wichtig mit Link · code')
		expect(noteExcerpt('a'.repeat(200), 20)).toHaveLength(20)
	})
})

describe('markdown - toolbar', () => {
	it('wraps the selection and unwraps it again', () => {
		const bold = applyFormat('ein Wort hier', 4, 8, 'bold')
		expect(bold).toEqual({ text: 'ein **Wort** hier', start: 6, end: 10 })
		expect(applyFormat(bold.text, bold.start, bold.end, 'bold').text).toBe('ein Wort hier')
	})

	it('inserts a placeholder without selection', () => {
		expect(applyFormat('', 0, 0, 'italic', { text: 'Text' })).toEqual({ text: '*Text*', start: 1, end: 5 })
	})

	it('toggles line formats on all selected lines', () => {
		const list = applyFormat('eins\nzwei', 0, 9, 'bullet')
		expect(list.text).toBe('- eins\n- zwei')
		expect(applyFormat(list.text, 0, list.text.length, 'bullet').text).toBe('eins\nzwei')
		expect(applyFormat('eins\nzwei', 0, 9, 'numbered').text).toBe('1. eins\n2. zwei')
		expect(applyFormat('- eins', 0, 0, 'task').text).toBe('- [ ] eins')
		expect(applyFormat('- [ ] eins', 0, 0, 'bullet').text).toBe('- eins')
		expect(applyFormat('Titel', 2, 2, 'heading').text).toBe('## Titel')
	})

	it('inserts links and blocks', () => {
		const link = applyFormat('siehe Wiki', 6, 10, 'link')
		expect(link.text).toBe('siehe [Wiki](https://)')
		expect(link.text.slice(link.start, link.end)).toBe('https://')
		expect(applyFormat('Text', 4, 4, 'rule').text).toBe('Text\n\n---\n')
		expect(applyFormat('', 0, 0, 'table', { column: 'Spalte' }).text).toBe('| Spalte 1 | Spalte 2 |\n| --- | --- |\n| | |\n')
	})
})

describe('markdown - continue lists', () => {
	it('continues bullets, numbers and checklists', () => {
		expect(continueList('- eins', 6)).toEqual({ text: '- eins\n- ', start: 9, end: 9 })
		expect(continueList('1. eins', 7).text).toBe('1. eins\n2. ')
		expect(continueList('  - [x] erledigt', 16).text).toBe('  - [x] erledigt\n  - [ ] ')
	})

	it('ends the list on an empty item and ignores normal lines', () => {
		expect(continueList('- eins\n- ', 9)).toEqual({ text: '- eins\n\n', start: 8, end: 8 })
		expect(continueList('- [ ] eins\n- [ ] ', 17)).toEqual({ text: '- [ ] eins\n\n', start: 12, end: 12 })
		// The text typed next is a paragraph, not part of the last item
		// (checked on the markdown-it output, happy-dom's DOMPurify drops the <ul>)
		expect(getRenderer().render('- [ ] eins\n\n**Wichtig**')).toMatch(/<\/ul>\s*<p><strong>Wichtig<\/strong><\/p>/)
		// Nested: one level out
		expect(continueList('- eins\n  - ', 11)).toEqual({ text: '- eins\n- ', start: 9, end: 9 })
		// In a quote the quote goes on
		expect(continueList('> - eins\n> - ', 13)).toEqual({ text: '> - eins\n>\n> ', start: 13, end: 13 })
		expect(continueList('normaler Text', 13)).toBe(null)
		expect(continueList('- eins mittendrin', 3)).toBe(null)
	})
})
