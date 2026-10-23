import { normalizeHref, parseSyncResponse, parseTokens, planChanges } from '../../../../src/tb/live.js'

import { describe, expect, it } from 'vitest'

const XML = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns">
 <d:response>
  <d:href>/remote.php/dav/calendars/admin/work/a.ics</d:href>
  <d:propstat><d:prop><d:getetag>"e1"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
 </d:response>
 <d:response>
  <d:href>/remote.php/dav/calendars/admin/work/M%C3%BCll.ics</d:href>
  <d:propstat><d:prop><d:getetag>"e2"</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat>
 </d:response>
 <d:response>
  <d:href>/remote.php/dav/calendars/admin/work/gone.ics</d:href>
  <d:status>HTTP/1.1 404 Not Found</d:status>
 </d:response>
 <d:sync-token>http://sabre.io/ns/sync/42</d:sync-token>
</d:multistatus>`

const task = (url, etag, uid = url) => ({ uid, key: uid + '~work', dav: { url, etag } })

describe('live updates', () => {
	it('reads the sync answer', () => {
		const report = parseSyncResponse(XML)
		expect(report.token).toBe('http://sabre.io/ns/sync/42')
		expect(report.changed).toEqual([
			{ href: '/remote.php/dav/calendars/admin/work/a.ics', etag: '"e1"' },
			{ href: '/remote.php/dav/calendars/admin/work/M%C3%BCll.ics', etag: '"e2"' },
		])
		expect(report.removed).toEqual(['/remote.php/dav/calendars/admin/work/gone.ics'])
	})

	it('compares hrefs decoded and without the host', () => {
		expect(normalizeHref('https://cloud.example.com/remote.php/dav/calendars/admin/work/M%C3%BCll.ics')).toBe('/remote.php/dav/calendars/admin/work/Müll.ics')
	})

	it('fetches only tasks whose ETag changed and removes deleted ones', () => {
		const report = parseSyncResponse(XML)
		const same = task('/remote.php/dav/calendars/admin/work/a.ics', '"e1"')
		const changed = task('/remote.php/dav/calendars/admin/work/Müll.ics', '"old"')
		const gone = task('/remote.php/dav/calendars/admin/work/gone.ics', '"x"')
		const plan = planChanges([same, changed, gone], report)
		expect(plan.fetch).toEqual(['/remote.php/dav/calendars/admin/work/M%C3%BCll.ics'])
		expect(plan.remove).toEqual([gone])
	})

	it('treats missing tasks as deleted after a full sync and keeps pending ones', () => {
		const report = { token: 't', changed: [{ href: '/c/a.ics', etag: '"1"' }], removed: [] }
		const a = task('/c/a.ics', '"1"')
		const b = task('/c/b.ics', '"1"')
		expect(planChanges([a, b], report, { full: true })).toEqual({ fetch: [], remove: [b] })
		expect(planChanges([a, b], { token: 't', changed: [], removed: [] }, { pending: ['/c/b.ics'] })).toEqual({ fetch: ['/c/b.ics'], remove: [] })
	})

	it('reads the sync tokens of all lists', () => {
		const xml = `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
 <d:response><d:href>/remote.php/dav/calendars/admin/</d:href><d:propstat><d:prop/><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
 <d:response><d:href>/remote.php/dav/calendars/admin/work/</d:href><d:propstat><d:prop><d:sync-token>http://sabre.io/ns/sync/7</d:sync-token></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
 <d:response><d:href>/remote.php/dav/calendars/admin/M%C3%BCll_shared_by_max/</d:href><d:propstat><d:prop><d:sync-token>http://sabre.io/ns/sync/9</d:sync-token></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>
</d:multistatus>`
		const tokens = parseTokens(xml)
		expect([...tokens.entries()]).toEqual([
			['/remote.php/dav/calendars/admin/work/', 'http://sabre.io/ns/sync/7'],
			['/remote.php/dav/calendars/admin/Müll_shared_by_max/', 'http://sabre.io/ns/sync/9'],
		])
	})
})
