# Tasks Board

**Tasks with board, table, dashboard and assignments for [Nextcloud](https://nextcloud.com).**

Tasks Board is based on the [Nextcloud Tasks](https://github.com/nextcloud/tasks) app. It uses the same CalDAV task lists, so both apps can be enabled side by side and every CalDAV client keeps working. It is an independent project and not affiliated with Nextcloud GmbH.

## Features

Everything the Tasks app does (lists, subtasks, smart collections, start and due dates, priorities, repeating tasks, sharing, CalDAV sync), and in addition:

* **Board** (Kanban) with the columns Open, In progress, Waiting and Done (cancelled tasks on request). Drag cards between columns, sort them by hand, show rows per priority, list, main task, tag or person, open subtasks on the card.
* **Table** with columns you can show, hide, move and sort (title, person, start, due, list, main task, status, priority, tags, progress, overview, created, last modified). Status, priority, person and due date can be changed right in the cell.
* **Dashboard** with the current state, the distribution per person, list, project, priority and tag, the history of the last 12 weeks and the tasks that need attention (overdue, follow-up due, nobody assigned, important but untouched for two weeks). Filters for lists, project, persons and tags.
* **Assign tasks** to one person who has access to the list (owner and everyone it is shared with, also via groups). Collection "Assigned to me", sorting, grouping, board rows and filter by person.
* **Waiting and follow-up:** a task waits when it has the waiting tag or starts in the future. Collections "Waiting" and "Follow-up due", a dialog to pick the follow-up date and a reminder when it is reached.
* **Notifications** when a task is assigned to you, when a task you assigned is completed, when a follow-up date is reached and when a task is due today. Each kind can be switched off.
* **Templates:** a template list holds tasks with subtasks, "Create from template" copies them into any list.
* **Fixed tag list** that is suggested to everyone first. Tags that are not in the list are marked.
* **Multi-select** with actions for all selected tasks (complete or reopen, status, person, tags, priority, due date, move to another list).
* **Notes editor** with a Markdown toolbar and checklists you can tick off directly in the sidebar.
* **More sort orders** (status, progress, person, list, main task), a separate order for subtasks and grouping in the list view (status, tag, priority).
* **Automatic progress** of main tasks from their subtasks, new subtasks take over priority, tags and person of the main task.
* **Keyboard shortcuts** (press `?` in the app), list as cards or compact rows, collapsible subtasks, navigation and sidebar you can resize and collapse.

## Installation

### From a release

1. Download `tasks_board.tar.gz` from the [releases](https://github.com/its-sven/Tasks-Board/releases) (once available).
2. Extract it into the `apps` (or `custom_apps`) folder of your Nextcloud, so that the folder is called `tasks_board`.
3. Enable it under »Apps« or with `php occ app:enable tasks_board`.

### From source

```bash
git clone https://github.com/its-sven/Tasks-Board.git tasks_board
cd tasks_board
make appstore
```

The package is created in `build/artifacts/appstore/tasks_board.tar.gz`. Requirements: Nextcloud 31 or newer and PHP 8.2 or newer; for building Node.js and npm (versions see `engines` in `package.json`).

### Settings

All settings are under »Tasks settings« at the bottom of the navigation:

* **For everyone:** automatic progress, notifications, template list, view options.
* **For administrators:** the fixed tag list and the waiting tag. Without a setting the waiting tag is `wartet` on instances whose default language is German and `waiting` otherwise.

The follow-up and due-today reminders are sent by a background job (hourly). Make sure the Nextcloud background jobs run via cron.

## Apps which sync with the task lists (using CalDAV)

Tasks Board stores everything in standard CalDAV tasks (VTODO). Assignments are written as `ATTENDEE` with `SCHEDULE-AGENT=CLIENT`, so the server does not send invitation e-mails. All CalDAV clients that work with Nextcloud Tasks work with Tasks Board too, for example Thunderbird, Apple Reminders, DAVx⁵ with [jtx Board](https://jtx.techbee.at/), [OpenTasks](https://opentasks.app/) or [Tasks.org](https://tasks.org/), GNOME, KDE and [vdirsyncer](https://vdirsyncer.pimutils.org/). See the [list in the Tasks app](https://github.com/nextcloud/tasks#apps-which-sync-with-nextcloud-tasks-using-caldav).

## ETag (or: problem with non-existing conflicts)

Like the Tasks app, Tasks Board uses the `ETag` HTTP header to detect conflicts. If `ETag`s are modified or removed (for example by anti-tracking browser extensions or a server configuration), the app reports conflicts that do not exist. See [nextcloud/tasks#2077](https://github.com/nextcloud/tasks/issues/2077) and [nextcloud/tasks#167](https://github.com/nextcloud/tasks/issues/167).

## Development

Clone the repository into the apps folder of a Nextcloud development instance (as `tasks_board`) and run

```bash
make            # installs the JavaScript dependencies and builds the app
npm run dev     # development build
npm run watch   # development build, rebuilt on changes
npm run lint    # ESLint
npm run test    # unit tests (Vitest)
```

Please run these commands with your normal user account, not as root.

Code layout: everything Tasks Board adds lives in `src/tb/` (components and views prefixed `Tb`, CSS classes and variables prefixed `tb-`), the PHP parts in `lib/` (`BoardController`, `AssignmentService`, `WaitingTag`, `FollowUpJob`, `Notifier`) and the tests in `tests/javascript/unit/tb/`. Files of the Tasks app are only changed where Tasks Board hooks in, marked with `Tasks Board:` comments. This keeps updates from the Tasks app easy to merge.

Texts of the new features are English in the code and translated in `src/tb/l10n.js` (currently German). The translations of the Tasks app in `l10n/` stay untouched, so they can be taken over with every update.

### Taking over updates from Nextcloud Tasks

```bash
git remote add upstream https://github.com/nextcloud/tasks.git
git fetch upstream
git merge upstream/main
```

## Credits and license

Tasks Board is a fork of [Nextcloud Tasks](https://github.com/nextcloud/tasks) by [Raimund Schlüßler](https://github.com/raimund-schluessler) [and many more](https://github.com/nextcloud/tasks/graphs/contributors). All changes compared to Nextcloud Tasks are listed in the [changelog](CHANGELOG.md).

Licensed under the [GNU Affero General Public License v3.0 or later](COPYING) (AGPL-3.0-or-later), like the Tasks app. "Nextcloud" is a trademark of Nextcloud GmbH.
