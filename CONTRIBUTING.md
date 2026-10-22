# Contributing to Tasks Board

Thanks for helping! Bug reports and ideas go into the [issues](https://github.com/its-sven/Tasks-Board/issues), code changes come as pull requests against the branch `tasks-board`.

If a problem also occurs in [Nextcloud Tasks](https://github.com/nextcloud/tasks), it most likely comes from there: please report it in its issue tracker, the fix will reach Tasks Board with the next update.

## Development setup

You need a Nextcloud development instance, PHP 8.2 or newer and Node.js and npm in the versions from `engines` in `package.json`.

```bash
cd /path/to/nextcloud/apps
git clone https://github.com/its-sven/Tasks-Board.git tasks_board
cd tasks_board
npm ci
composer install       # only needed for the PHP tests and code style
npm run dev            # or: npm run watch
php ../../occ app:enable tasks_board
```

The folder has to be called `tasks_board`, like the app id. Please run these commands with your normal user account, not as root.

## Checks

```bash
npm run lint           # ESLint
npm run test           # JavaScript unit tests (Vitest)
composer run lint      # PHP syntax
composer run cs:check  # PHP code style (composer run cs:fix fixes it)
composer run test:unit # PHP unit tests, inside a Nextcloud instance
```

The same checks run on GitHub for every push and pull request.

## Code layout

Tasks Board keeps its own code apart from the files of Nextcloud Tasks, so that updates from there stay easy to merge:

| Where | What |
| --- | --- |
| `src/tb/` | Everything new in the frontend: board, table, dashboard, assignment, templates, store modules, styles |
| `src/tb/components/`, `src/tb/views/` | Vue components and views, names start with `Tb` |
| `src/tb/l10n.js` | Translations of the new texts (see below) |
| `src/tb/theme.scss` | The look; CSS classes and variables start with `tb-` |
| `lib/` | `BoardController`, `AssignmentService`, `WaitingTag`, `FollowUpJob`, `Notifier` (the other files come from Tasks) |
| `tests/javascript/unit/tb/` | Unit tests of the new parts |

Files of Nextcloud Tasks are only changed where Tasks Board hooks in. Those places are marked with a `Tasks Board:` comment. Please keep it that way: put new logic into `src/tb/` and only add a small hook to the upstream file.

New files start with an SPDX header:

```js
/**
 * SPDX-FileCopyrightText: 2026 Your Name
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */
```

## Translations

Texts of the new features are written in English in the code and translated with `tbt()` from `src/tb/l10n.js`. To add a language, add a block to the `translations` object there (for example `fr: { ... }`) with the English text as key.

The files in `l10n/` belong to Nextcloud Tasks and are replaced with every update from there. Please do not change them.

## Taking over updates from Nextcloud Tasks

```bash
git remote add upstream https://github.com/nextcloud/tasks.git   # once
git fetch upstream
git switch tasks-board
git merge upstream/main
```

Conflicts usually show up in `package.json`, `package-lock.json` (run `npm install` and commit the result) and in the few upstream files with `Tasks Board:` hooks. After the merge run all checks and try the app before you release.

The branch `main` mirrors Nextcloud Tasks ("Sync fork" on GitHub), the work happens on `tasks-board`.

## Commits and pull requests

* One topic per pull request, with a short description of what changes for the user.
* Add an entry to `CHANGELOG.md` under the next version for changes users will notice.
* Screenshots help for changes to the user interface.

## Releases

See [docs/RELEASING.md](docs/RELEASING.md).
