import { isTaskInList } from '../../../../src/store/storeHelper.js'
import {
	prepareTemplateCopy,
	resolveTemplateCalendar,
	setActiveTemplateId,
	templateSize,
	templateTasks,
} from '../../../../src/tb/templates.js'
import { link, makeCalendar, makeTask } from './helpers.js'

import moment from '@nextcloud/moment'
import { afterEach, describe, expect, it } from 'vitest'

describe('templates - template list', () => {
	const work = makeCalendar('work')
	const own = makeCalendar('vorlagen', { displayName: 'Vorlagen' })
	const shared = makeCalendar('vorlagen_shared_by_anna', { displayName: ' vorlagen ', isSharedWithMe: true })

	it('uses the own list named "Vorlagen" without a setting', () => {
		expect(resolveTemplateCalendar('', [work, shared, own])).toBe(own)
		expect(resolveTemplateCalendar('', [work, shared])).toBe(shared)
		expect(resolveTemplateCalendar('', [work])).toBe(null)
	})

	it('uses the chosen list or none', () => {
		expect(resolveTemplateCalendar('work', [work, own])).toBe(work)
		expect(resolveTemplateCalendar('none', [work, own])).toBe(null)
		expect(resolveTemplateCalendar('gone', [work, own])).toBe(null)
	})
})

describe('templates - collections', () => {
	afterEach(() => setActiveTemplateId(null))

	it('tasks of the template list are not in the collections, but in the list', () => {
		const templates = makeCalendar('vorlagen', { displayName: 'Vorlagen' })
		const work = makeCalendar('work')
		const template = makeTask(templates, { uid: 'tpl', priority: 1 })
		const normal = makeTask(work, { uid: 'n', priority: 1 })
		expect(isTaskInList(template, 'all')).toBe(true)

		setActiveTemplateId('vorlagen')
		for (const collection of ['all', 'starred', 'current', 'today', 'week', 'completed', 'assigned', 'waiting', 'followup']) {
			expect(isTaskInList(template, collection)).toBe(false)
		}
		expect(isTaskInList(template, 'vorlagen')).toBe(true)
		expect(isTaskInList(normal, 'all')).toBe(true)
		expect(isTaskInList(normal, 'starred')).toBe(true)
	})
})

describe('templates - choosing and copying', () => {
	const setup = () => {
		const calendar = makeCalendar('vorlagen', { displayName: 'Vorlagen' })
		const onboarding = makeTask(calendar, { uid: 'on', summary: 'Onboarding' })
		const laptop = makeTask(calendar, { uid: 'l', summary: 'Laptop', related: 'on' })
		const account = makeTask(calendar, { uid: 'a', summary: 'Konto', related: 'on' })
		const old = makeTask(calendar, { uid: 'o', summary: 'Alt', related: 'on', status: 'CANCELLED' })
		const mail = makeTask(calendar, { uid: 'm', summary: 'Mail', related: 'a' })
		link(onboarding, laptop)
		link(onboarding, account)
		link(onboarding, old)
		link(account, mail)
		const audit = makeTask(calendar, { uid: 'au', summary: 'audit' })
		const done = makeTask(calendar, { uid: 'done', summary: 'Erledigt', status: 'COMPLETED', percent: 100, completed: moment() })
		makeTask(calendar, { uid: 'gone', summary: 'Abgebrochen', status: 'CANCELLED' })
		return { calendar, onboarding, audit, done }
	}

	it('offers the main tasks (not cancelled ones), sorted by name', () => {
		const { calendar, onboarding, audit, done } = setup()
		expect(templateTasks(calendar)).toEqual([audit, done, onboarding])
		expect(templateTasks(null)).toEqual([])
	})

	it('counts the tasks a template creates (without cancelled subtasks)', () => {
		const { onboarding, audit } = setup()
		expect(templateSize(onboarding)).toBe(4)
		expect(templateSize(audit)).toBe(1)
	})

	it('a copy is open again and gets the new title', () => {
		const calendar = makeCalendar('vorlagen')
		const done = makeTask(calendar, { uid: 'd', summary: 'Vorlage', status: 'COMPLETED', percent: 100, completed: moment() })
		prepareTemplateCopy(done, { summary: '  Onboarding Max  ' })
		expect(done.summary).toBe('Onboarding Max')
		expect(done.completed).toBe(false)
		expect(done.complete).toBe(0)
		expect(done.status).toBe('NEEDS-ACTION')

		const half = makeTask(calendar, { uid: 'h', summary: 'Halb', status: 'IN-PROCESS', percent: 40 })
		prepareTemplateCopy(half)
		expect(half.summary).toBe('Halb')
		expect(half.complete).toBe(0)
		expect(half.status).toBe('NEEDS-ACTION')

		const plain = makeTask(calendar, { uid: 'p', summary: 'Neu' })
		prepareTemplateCopy(plain, { summary: ' ' })
		expect(plain.summary).toBe('Neu')
		expect(plain.status).toBe(null)
	})
})
