<?php
/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\TasksBoard\Service;

use OCA\TasksBoard\AppInfo\Application;
use OCP\IConfig;
use OCP\IDBConnection;
use OCP\IGroupManager;
use OCP\IUserManager;
use OCP\Notification\IManager as INotificationManager;
use Sabre\VObject\Component;
use Sabre\VObject\Reader;

/**
 * Assignment of tasks to persons.
 *
 * A task is assigned by an ATTENDEE with the parameter X-NC-USERID (and
 * X-TASKS-BOARD-ASSIGNED-BY for the person who assigned it). The app writes these via
 * CalDAV. This service only reads: who may be assigned (everyone with access to
 * the list) and whether a notification is justified by the stored task.
 */
class AssignmentService {
	/** Access values of oc_dav_shares (see OCA\DAV\DAV\Sharing\Backend) */
	private const ACCESS_UNSHARED = 5;

	public function __construct(
		private IDBConnection $db,
		private IUserManager $userManager,
		private IGroupManager $groupManager,
		private IConfig $config,
		private INotificationManager $notificationManager,
	) {
	}

	/**
	 * Resolves a list id as used in the app URL (last part of the CalDAV URL)
	 * for a user and checks that the user has access to the list.
	 *
	 * @param string $userId The user
	 * @param string $calendarId "<uri>" for own lists, "<uri>_shared_by_<owner>" for shared ones
	 * @return array{id: int, owner: string, uri: string, displayName: string}|null
	 */
	public function resolveCalendar(string $userId, string $calendarId): ?array {
		$owner = $userId;
		$uri = $calendarId;
		$pos = strrpos($calendarId, '_shared_by_');
		if ($pos !== false) {
			$uri = substr($calendarId, 0, $pos);
			$owner = substr($calendarId, $pos + strlen('_shared_by_'));
		}
		if ($uri === '' || $owner === '') {
			return null;
		}

		$qb = $this->db->getQueryBuilder();
		$qb->select('id', 'displayname')
			->from('calendars')
			->where($qb->expr()->eq('principaluri', $qb->createNamedParameter('principals/users/' . $owner)))
			->andWhere($qb->expr()->eq('uri', $qb->createNamedParameter($uri)))
			->andWhere($qb->expr()->isNull('deleted_at'));
		$result = $qb->executeQuery();
		$row = $result->fetch();
		$result->closeCursor();
		if (!$row) {
			return null;
		}

		$calendar = [
			'id' => (int)$row['id'],
			'owner' => $owner,
			'uri' => $uri,
			'displayName' => (string)$row['displayname'],
		];
		if ($owner !== $userId && !in_array($userId, $this->getMemberIds($calendar), true)) {
			return null;
		}
		return $calendar;
	}

	/**
	 * Users with access to a list: the owner and everyone it is shared with
	 * (directly or through a group). Disabled users are left out.
	 *
	 * @param array $calendar As returned by resolveCalendar()
	 * @return string[] User ids
	 */
	public function getMemberIds(array $calendar): array {
		$ids = [$calendar['owner'] => true];
		$unshared = [];

		$qb = $this->db->getQueryBuilder();
		$qb->select('principaluri', 'access')
			->from('dav_shares')
			->where($qb->expr()->eq('resourceid', $qb->createNamedParameter($calendar['id'])))
			->andWhere($qb->expr()->eq('type', $qb->createNamedParameter('calendar')));
		$result = $qb->executeQuery();
		$groups = [];
		while ($row = $result->fetch()) {
			$principal = (string)$row['principaluri'];
			if (str_starts_with($principal, 'principals/users/')) {
				$id = rawurldecode(substr($principal, strlen('principals/users/')));
				if ((int)$row['access'] === self::ACCESS_UNSHARED) {
					// A user removed a group share for themselves
					$unshared[$id] = true;
				} else {
					$ids[$id] = true;
				}
			} elseif (str_starts_with($principal, 'principals/groups/')) {
				$groups[] = rawurldecode(substr($principal, strlen('principals/groups/')));
			}
		}
		$result->closeCursor();

		foreach ($groups as $groupId) {
			$group = $this->groupManager->get($groupId);
			if ($group === null) {
				continue;
			}
			foreach ($group->getUsers() as $user) {
				if (!isset($unshared[$user->getUID()])) {
					$ids[$user->getUID()] = true;
				}
			}
		}

		$members = [];
		foreach (array_keys($ids) as $id) {
			$user = $this->userManager->get((string)$id);
			if ($user !== null && $user->isEnabled()) {
				$members[] = $user->getUID();
			}
		}
		return $members;
	}

	/**
	 * The persons a task in this list can be assigned to
	 *
	 * @param array $calendar As returned by resolveCalendar()
	 * @return array List of ['uid', 'displayName', 'email']
	 */
	public function getAssignees(array $calendar): array {
		$people = [];
		foreach ($this->getMemberIds($calendar) as $id) {
			$user = $this->userManager->get($id);
			if ($user === null) {
				continue;
			}
			$people[] = [
				'uid' => $user->getUID(),
				'displayName' => $user->getDisplayName(),
				'email' => (string)($user->getEMailAddress() ?? ''),
			];
		}
		usort($people, fn ($a, $b) => strcasecmp($a['displayName'], $b['displayName']));
		return $people;
	}

	/**
	 * Reads a task as stored on the server
	 *
	 * @param array $calendar As returned by resolveCalendar()
	 * @param string $objectUri File name of the task (*.ics)
	 * @return Component|null The VTODO
	 */
	public function getTask(array $calendar, string $objectUri): ?Component {
		$qb = $this->db->getQueryBuilder();
		$qb->select('calendardata')
			->from('calendarobjects')
			->where($qb->expr()->eq('calendarid', $qb->createNamedParameter($calendar['id'])))
			->andWhere($qb->expr()->eq('uri', $qb->createNamedParameter($objectUri)))
			->andWhere($qb->expr()->eq('calendartype', $qb->createNamedParameter(0)))
			->andWhere($qb->expr()->isNull('deleted_at'));
		$result = $qb->executeQuery();
		$data = $result->fetchOne();
		$result->closeCursor();
		if ($data === false || $data === null) {
			return null;
		}
		if (is_resource($data)) {
			$data = stream_get_contents($data);
		}
		try {
			$vcalendar = Reader::read((string)$data);
		} catch (\Throwable $e) {
			return null;
		}
		$vtodo = $vcalendar->VTODO ?? null;
		return $vtodo instanceof Component ? $vtodo : null;
	}

	/**
	 * The assigned person of a task
	 *
	 * @param Component $vtodo The task
	 * @return array{uid: string, assignedBy: string}|null
	 */
	public function readAssignee(Component $vtodo): ?array {
		foreach ($vtodo->select('ATTENDEE') as $attendee) {
			$uid = isset($attendee['X-NC-USERID']) ? (string)$attendee['X-NC-USERID'] : '';
			if ($uid !== '') {
				return [
					'uid' => $uid,
					'assignedBy' => isset($attendee['X-TASKS-BOARD-ASSIGNED-BY']) ? (string)$attendee['X-TASKS-BOARD-ASSIGNED-BY'] : '',
				];
			}
		}
		return null;
	}

	/**
	 * Whether a user wants a kind of notification (Tasks Board preferences, default: yes)
	 *
	 * @param string $userId The user
	 * @param string $pref notifyAssigned or notifyCompleted
	 * @return bool
	 */
	public function wantsNotification(string $userId, string $pref): bool {
		$prefs = json_decode((string)$this->config->getUserValue($userId, Application::APP_ID, 'various_tbPrefs', '{}'), true);
		if (!is_array($prefs) || !array_key_exists($pref, $prefs)) {
			return true;
		}
		return $prefs[$pref] !== false;
	}

	/**
	 * Id for the notification object (max. 64 characters)
	 *
	 * @param array $calendar The list
	 * @param string $taskUid UID of the task
	 * @return string
	 */
	private function objectId(array $calendar, string $taskUid): string {
		$id = $calendar['id'] . ':' . $taskUid;
		return strlen($id) > 64 ? $calendar['id'] . ':' . md5($taskUid) : $id;
	}

	/**
	 * Sends a notification for a task if the stored task justifies it.
	 *
	 * - assigned:  the assignee gets a notification (unless they assigned themselves)
	 * - completed: whoever assigned the task gets a notification when someone else completed it
	 *
	 * @param string $actorId The user who made the change
	 * @param string $type assigned or completed
	 * @param string $calendarId List id as in the app URL (of the actor)
	 * @param string $objectUri File name of the task
	 * @return array{sent: bool, reason: string}
	 */
	public function notify(string $actorId, string $type, string $calendarId, string $objectUri): array {
		if (!in_array($type, ['assigned', 'completed'], true)) {
			return ['sent' => false, 'reason' => 'type'];
		}
		$calendar = $this->resolveCalendar($actorId, $calendarId);
		if ($calendar === null) {
			return ['sent' => false, 'reason' => 'calendar'];
		}
		$vtodo = $this->getTask($calendar, $objectUri);
		if ($vtodo === null) {
			return ['sent' => false, 'reason' => 'task'];
		}
		$assignee = $this->readAssignee($vtodo);
		$taskUid = (string)$vtodo->UID;
		$summary = isset($vtodo->SUMMARY) ? (string)$vtodo->SUMMARY : '';
		$objectId = $this->objectId($calendar, $taskUid);

		if ($type === 'assigned') {
			// Older notifications about this task are obsolete (e.g. someone else was assigned before)
			$this->dismiss($objectId);
			if ($assignee === null) {
				return ['sent' => false, 'reason' => 'unassigned'];
			}
			$recipient = $assignee['uid'];
			$pref = 'notifyAssigned';
		} else {
			$status = isset($vtodo->STATUS) ? strtoupper((string)$vtodo->STATUS) : '';
			if ($status !== 'COMPLETED' || $assignee === null || $assignee['assignedBy'] === '') {
				return ['sent' => false, 'reason' => 'not completed or not assigned'];
			}
			$recipient = $assignee['assignedBy'];
			$pref = 'notifyCompleted';
			// The assignee does not need the "assigned" notification any more
			$this->dismiss($objectId, $assignee['uid']);
		}

		if ($recipient === $actorId) {
			return ['sent' => false, 'reason' => 'self'];
		}
		if (!in_array($recipient, $this->getMemberIds($calendar), true)) {
			return ['sent' => false, 'reason' => 'no access'];
		}
		if (!$this->wantsNotification($recipient, $pref)) {
			return ['sent' => false, 'reason' => 'preference'];
		}

		$notification = $this->notificationManager->createNotification();
		$notification->setApp(Application::APP_ID)
			->setUser($recipient)
			->setDateTime(new \DateTime())
			->setObject('task', $objectId)
			->setSubject($type, [
				'actor' => $actorId,
				'summary' => mb_substr($summary, 0, 200),
				'owner' => $calendar['owner'],
				'calendarUri' => $calendar['uri'],
				'calendarName' => mb_substr($calendar['displayName'], 0, 100),
				'objectUri' => $objectUri,
			]);
		$this->notificationManager->notify($notification);
		return ['sent' => true, 'reason' => ''];
	}

	/**
	 * Reminders for today (hourly job):
	 *
	 * - followup: tasks with the waiting tag whose start date (follow-up date) is today
	 * - due:      open tasks whose due date is today
	 *
	 * The notification goes to the assigned person, otherwise to the owner of the
	 * list, at the earliest at 6 o'clock in the time zone of that person. Each task
	 * is notified once per date. Template lists are skipped.
	 *
	 * @return int Number of notifications sent
	 */
	public function notifyDueFollowUps(): int {
		$marks = json_decode($this->config->getAppValue(Application::APP_ID, 'followup_sent', '{}'), true);
		if (!is_array($marks)) {
			$marks = [];
		}

		$qb = $this->db->getQueryBuilder();
		$qb->select('co.calendardata', 'co.uri', 'co.calendarid', 'c.principaluri', 'c.uri AS calendaruri', 'c.displayname')
			->from('calendarobjects', 'co')
			->innerJoin('co', 'calendars', 'c', $qb->expr()->eq('c.id', 'co.calendarid'))
			->where($qb->expr()->eq('co.componenttype', $qb->createNamedParameter('VTODO')))
			->andWhere($qb->expr()->eq('co.calendartype', $qb->createNamedParameter(0)))
			->andWhere($qb->expr()->isNull('co.deleted_at'))
			->andWhere($qb->expr()->isNull('c.deleted_at'));
		$result = $qb->executeQuery();

		$waitingTag = WaitingTag::get($this->config);
		$sent = 0;
		while ($row = $result->fetch()) {
			$data = is_resource($row['calendardata']) ? stream_get_contents($row['calendardata']) : (string)$row['calendardata'];
			// Cheap pre-filter before parsing (LIKE does not work on blobs in every database),
			// everything is checked exactly below
			if (mb_stripos($data, $waitingTag) === false && stripos($data, "\nDUE") === false) {
				continue;
			}
			try {
				$vtodo = Reader::read($data)->VTODO ?? null;
			} catch (\Throwable $e) {
				continue;
			}
			if (!$vtodo instanceof Component || !$this->isOpen($vtodo)) {
				continue;
			}
			$principal = (string)$row['principaluri'];
			if (!str_starts_with($principal, 'principals/users/')) {
				continue;
			}
			$calendar = [
				'id' => (int)$row['calendarid'],
				'owner' => substr($principal, strlen('principals/users/')),
				'uri' => (string)$row['calendaruri'],
				'displayName' => (string)$row['displayname'],
			];
			$assignee = $this->readAssignee($vtodo);
			$recipient = $assignee !== null && in_array($assignee['uid'], $this->getMemberIds($calendar), true) ? $assignee['uid'] : $calendar['owner'];
			if ($this->isTemplateList($calendar, $recipient)) {
				continue;
			}

			// Dates in the time zone of the recipient, not before 6 o'clock
			$timezone = $this->config->getUserValue($recipient, 'core', 'timezone', date_default_timezone_get());
			try {
				$zone = new \DateTimeZone($timezone !== '' ? $timezone : 'UTC');
			} catch (\Throwable $e) {
				$zone = new \DateTimeZone('UTC');
			}
			$now = new \DateTimeImmutable('now', $zone);
			if ((int)$now->format('G') < 6) {
				continue;
			}
			$today = $now->format('Y-m-d');
			$taskUid = (string)$vtodo->UID;

			$reminders = [];
			if (isset($vtodo->DTSTART) && $this->hasTag($vtodo, $waitingTag)) {
				$reminders[] = ['followup', $calendar['id'] . ':' . $taskUid, $this->localDate($vtodo->DTSTART, $zone), 'notifyFollowUp'];
			}
			if (isset($vtodo->DUE)) {
				$reminders[] = ['due', 'due:' . $calendar['id'] . ':' . $taskUid, $this->localDate($vtodo->DUE, $zone), 'notifyDue'];
			}
			foreach ($reminders as [$type, $mark, $date, $pref]) {
				if ($date !== $today || ($marks[$mark] ?? '') === $date || !$this->wantsNotification($recipient, $pref)) {
					continue;
				}
				$notification = $this->notificationManager->createNotification();
				$notification->setApp(Application::APP_ID)
					->setUser($recipient)
					->setDateTime(new \DateTime())
					->setObject($type, $this->objectId($calendar, $taskUid))
					->setSubject($type, [
						'summary' => mb_substr(isset($vtodo->SUMMARY) ? (string)$vtodo->SUMMARY : '', 0, 200),
						'owner' => $calendar['owner'],
						'calendarUri' => $calendar['uri'],
						'calendarName' => mb_substr($calendar['displayName'], 0, 100),
						'objectUri' => (string)$row['uri'],
						'date' => $date,
					]);
				$this->notificationManager->notify($notification);
				$marks[$mark] = $date;
				$sent++;
			}
		}
		$result->closeCursor();

		// Forget marks older than 30 days
		$limit = (new \DateTimeImmutable('-30 days'))->format('Y-m-d');
		$marks = array_filter($marks, fn ($date) => is_string($date) && $date >= $limit);
		$this->config->setAppValue(Application::APP_ID, 'followup_sent', json_encode($marks));
		return $sent;
	}

	/**
	 * Date (Y-m-d) of a date property in a time zone (all-day dates stay as they are)
	 *
	 * @param \Sabre\VObject\Property\ICalendar\DateTime $property DTSTART or DUE
	 * @param \DateTimeZone $zone The time zone
	 * @return string
	 */
	private function localDate($property, \DateTimeZone $zone): string {
		try {
			$date = $property->getDateTime();
		} catch (\Throwable $e) {
			return '';
		}
		return $property->hasTime() ? $date->setTimezone($zone)->format('Y-m-d') : $date->format('Y-m-d');
	}

	/**
	 * Whether a list is the template list of its owner or of the recipient.
	 * Without a setting the list named "Vorlagen" (or "Templates") is the template list.
	 *
	 * @param array $calendar The list
	 * @param string $recipient The recipient of the notification
	 * @return bool
	 */
	private function isTemplateList(array $calendar, string $recipient): bool {
		$checks = [[$calendar['owner'], $calendar['uri']]];
		if ($recipient !== $calendar['owner']) {
			$checks[] = [$recipient, $calendar['uri'] . '_shared_by_' . $calendar['owner']];
		}
		foreach ($checks as [$userId, $calendarId]) {
			$prefs = json_decode((string)$this->config->getUserValue($userId, Application::APP_ID, 'various_tbPrefs', '{}'), true);
			$templateId = is_array($prefs) ? (string)($prefs['templateCalendarId'] ?? '') : '';
			if ($templateId !== '') {
				if ($templateId === $calendarId) {
					return true;
				}
			} elseif (in_array(mb_strtolower(trim($calendar['displayName'])), ['vorlagen', 'templates'], true)) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Whether a task is neither completed nor cancelled
	 *
	 * @param Component $vtodo The task
	 * @return bool
	 */
	private function isOpen(Component $vtodo): bool {
		$status = isset($vtodo->STATUS) ? strtoupper((string)$vtodo->STATUS) : '';
		return $status !== 'COMPLETED' && $status !== 'CANCELLED' && !isset($vtodo->COMPLETED);
	}

	/**
	 * Whether a task has a tag (case-insensitive)
	 *
	 * @param Component $vtodo The task
	 * @param string $name The tag
	 * @return bool
	 */
	private function hasTag(Component $vtodo, string $name): bool {
		foreach ($vtodo->select('CATEGORIES') as $categories) {
			foreach ($categories->getParts() as $tag) {
				if (mb_strtolower(trim((string)$tag)) === mb_strtolower($name)) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * Removes notifications about a task
	 *
	 * @param string $objectId The notification object id
	 * @param string|null $userId Only for this user (null: everyone)
	 */
	private function dismiss(string $objectId, ?string $userId = null): void {
		$notification = $this->notificationManager->createNotification();
		$notification->setApp(Application::APP_ID)->setObject('task', $objectId);
		if ($userId !== null) {
			$notification->setUser($userId);
		}
		$this->notificationManager->markProcessed($notification);
	}
}
