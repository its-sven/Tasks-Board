import { moveIndex, shortcutAction, shortcutsBlocked } from '../../../../src/tb/shortcuts.js'

import { describe, expect, it } from 'vitest'

const key = (value, extra = {}) => ({ key: value, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra })

describe('shortcuts', () => {
	it('maps keys to actions', () => {
		expect(shortcutAction(key('n'))).toBe('newTask')
		expect(shortcutAction(key('j'))).toBe('next')
		expect(shortcutAction(key('ArrowUp'))).toBe('previous')
		expect(shortcutAction(key('b'))).toBe('board')
		expect(shortcutAction(key('?', { shiftKey: true }))).toBe('help')
		expect(shortcutAction(key('n', { ctrlKey: true }))).toBe(null)
		expect(shortcutAction(key('q'))).toBe(null)
	})

	it('Enter, Space and X only act on a focused task', () => {
		expect(shortcutAction(key('Enter'))).toBe(null)
		expect(shortcutAction(key(' '))).toBe(null)
		expect(shortcutAction(key('x'))).toBe(null)
		expect(shortcutAction(key('Enter'), { onTask: true })).toBe('open')
		expect(shortcutAction(key(' '), { onTask: true })).toBe('toggle')
		expect(shortcutAction(key('x'), { onTask: true })).toBe('select')
	})

	it('is off while typing or with an open menu', () => {
		document.body.innerHTML = '<input id="i"><div id="d" tabindex="0"></div>'
		const input = document.getElementById('i')
		const div = document.getElementById('d')
		expect(shortcutsBlocked({ ...key('n'), target: input })).toBe(true)
		expect(shortcutsBlocked({ ...key('n'), target: div })).toBe(false)
		expect(shortcutsBlocked({ ...key('n'), target: div, isComposing: true })).toBe(true)
		expect(shortcutsBlocked({ ...key('n'), target: div, repeat: true })).toBe(true)
		expect(shortcutsBlocked({ ...key('j'), target: div, repeat: true })).toBe(false)
		document.body.insertAdjacentHTML('beforeend', '<div class="modal-mask"></div>')
		expect(shortcutsBlocked({ ...key('n'), target: div })).toBe(true)
		document.body.innerHTML = ''
	})

	it('moves the focus within the list', () => {
		expect(moveIndex(-1, 3, 1)).toBe(0)
		expect(moveIndex(-1, 3, -1)).toBe(2)
		expect(moveIndex(1, 3, 1)).toBe(2)
		expect(moveIndex(2, 3, 1)).toBe(2)
		expect(moveIndex(0, 3, -1)).toBe(0)
		expect(moveIndex(0, 0, 1)).toBe(-1)
	})
})
