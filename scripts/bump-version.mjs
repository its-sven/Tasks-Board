#!/usr/bin/env node
/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

/**
 * Sets the version of Tasks Board in appinfo/info.xml, package.json and
 * package-lock.json and adds an empty section to CHANGELOG.md if there is none.
 *
 * Usage: node scripts/bump-version.mjs 1.0.1
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const version = process.argv[2] || ''

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
	console.error('Usage: node scripts/bump-version.mjs <version>, e.g. 1.0.1')
	process.exit(1)
}

const path = (file) => join(root, file)
const read = (file) => readFileSync(path(file), 'utf8')
const write = (file, text) => writeFileSync(path(file), text)

// appinfo/info.xml: the first <version> is the version of the app
const info = read('appinfo/info.xml')
const before = info.match(/<version>([^<]*)<\/version>/)?.[1]
write('appinfo/info.xml', info.replace(/<version>[^<]*<\/version>/, `<version>${version}</version>`))

// package.json and package-lock.json
const pkg = JSON.parse(read('package.json'))
pkg.version = version
write('package.json', JSON.stringify(pkg, null, 2) + '\n')

const lock = JSON.parse(read('package-lock.json'))
lock.version = version
if (lock.packages?.['']) {
	lock.packages[''].version = version
}
write('package-lock.json', JSON.stringify(lock, null, 2) + '\n')

// CHANGELOG.md: new section on top
const changelog = read('CHANGELOG.md')
const escaped = version.replace(/\./g, '\\.')
if (new RegExp(`^## \\[?${escaped}\\]?( |$)`, 'm').test(changelog)) {
	console.log(`CHANGELOG.md already has a section for ${version}`)
} else {
	const today = new Date().toISOString().slice(0, 10)
	const section = `## ${version} - ${today}\n\n### Added\n- \n\n### Changed\n- \n\n### Fixed\n- \n\n`
	write('CHANGELOG.md', section + changelog)
	console.log(`Added a section for ${version} to CHANGELOG.md, please fill it in (empty headings can go)`)
}

console.log(`Version ${before} -> ${version} in appinfo/info.xml, package.json and package-lock.json`)
console.log(`Next: commit, then git tag -a v${version} -m "Tasks Board ${version}" and git push --follow-tags`)
