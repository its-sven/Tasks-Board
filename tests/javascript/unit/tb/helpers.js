import Task from '../../../../src/models/task.js'

const fmtDate = (m) => m.format('YYYYMMDD')
const fmtDateTime = (m) => m.clone().utc().format('YYYYMMDD[T]HHmmss[Z]')

/**
 * @param {string} id Calendar id
 * @param {object} extra Additional properties
 * @return {object} A minimal calendar
 */
export function makeCalendar(id, extra = {}) {
	return { id, displayName: 'List ' + id, color: '#123456', readOnly: false, isSharedWithMe: false, tasks: {}, ...extra }
}

/**
 * @param {object} calendar The calendar
 * @param {object} props The task properties
 * @return {Task} The task, added to the calendar
 */
export function makeTask(calendar, props) {
	const { uid, summary = props.uid, status, percent, start, due, tags, priority, completed, related, modified, created, attendee } = props
	const lines = [
		'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tasks Board//test//EN', 'BEGIN:VTODO',
		'UID:' + uid, 'DTSTAMP:20261001T080000Z', 'CREATED:' + (created ? fmtDateTime(created) : '20261001T080000Z'), 'SUMMARY:' + summary,
	]
	if (due) lines.push('DUE;VALUE=DATE:' + fmtDate(due))
	if (modified) lines.push('LAST-MODIFIED:' + fmtDateTime(modified))
	if (status) lines.push('STATUS:' + status)
	if (percent !== undefined) lines.push('PERCENT-COMPLETE:' + percent)
	if (start) lines.push('DTSTART;VALUE=DATE:' + fmtDate(start))
	if (tags) lines.push('CATEGORIES:' + tags.join(','))
	if (priority) lines.push('PRIORITY:' + priority)
	if (completed) lines.push('COMPLETED:' + fmtDateTime(completed))
	if (related) lines.push('RELATED-TO;RELTYPE=PARENT:' + related)
	if (attendee) lines.push(attendee)
	lines.push('END:VTODO', 'END:VCALENDAR', '')
	const task = new Task(lines.join('\r\n'), calendar)
	calendar.tasks[task.uid] = task
	return task
}

/**
 * @param {Task} parent The parent
 * @param {Task} child The subtask
 */
export function link(parent, child) {
	parent.subTasks[child.uid] = child
}
