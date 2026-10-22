<?php
/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\TasksBoard\Notification;

use OCA\TasksBoard\AppInfo\Application;
use OCP\IURLGenerator;
use OCP\IUserManager;
use OCP\Notification\INotification;
use OCP\Notification\INotifier;
use OCP\Notification\UnknownNotificationException;

/**
 * Texts and links of the Tasks Board notifications (assigned, completed, follow-up, due today)
 */
class Notifier implements INotifier {
	/** Texts in German and English (English is used for all other languages) */
	private const TEXTS = [
		'de' => [
			'name' => 'Tasks Board',
			'assigned' => '{actor} hat dir eine Aufgabe zugewiesen: {task}',
			'completed' => '{actor} hat eine Aufgabe erledigt, die du zugewiesen hast: {task}',
			'followup' => 'Wiedervorlage fällig: {task}',
			'due' => 'Heute fällig: {task}',
			'list' => 'Liste: {list}',
		],
		'en' => [
			'name' => 'Tasks Board',
			'assigned' => '{actor} assigned a task to you: {task}',
			'completed' => '{actor} completed a task you assigned: {task}',
			'followup' => 'Follow-up due: {task}',
			'due' => 'Due today: {task}',
			'list' => 'List: {list}',
		],
	];

	public function __construct(
		private IURLGenerator $urlGenerator,
		private IUserManager $userManager,
	) {
	}

	public function getID(): string {
		return Application::APP_ID;
	}

	public function getName(): string {
		return self::TEXTS['de']['name'];
	}

	public function prepare(INotification $notification, string $languageCode): INotification {
		if ($notification->getApp() !== Application::APP_ID) {
			throw new UnknownNotificationException();
		}
		$subject = $notification->getSubject();
		if (!in_array($subject, ['assigned', 'completed', 'followup', 'due'], true)) {
			throw new UnknownNotificationException();
		}
		$texts = self::TEXTS[str_starts_with($languageCode, 'de') ? 'de' : 'en'];
		$params = $notification->getSubjectParameters();

		$actorId = (string)($params['actor'] ?? '');
		$actorName = $this->userManager->getDisplayName($actorId) ?? $actorId;
		$summary = (string)($params['summary'] ?? '');
		$richParams = [
			'task' => [
				'type' => 'highlight',
				'id' => (string)($params['objectUri'] ?? ''),
				'name' => $summary !== '' ? $summary : '…',
			],
		];
		if (!in_array($subject, ['followup', 'due'], true)) {
			$richParams['actor'] = [
				'type' => 'user',
				'id' => $actorId,
				'name' => $actorName,
			];
		}
		$text = $texts[$subject];
		$notification->setRichSubject($text, $richParams);
		$notification->setParsedSubject(str_replace(['{actor}', '{task}'], [$actorName, $richParams['task']['name']], $text));

		$listName = (string)($params['calendarName'] ?? '');
		if ($listName !== '') {
			$notification->setParsedMessage(str_replace('{list}', $listName, $texts['list']));
		}

		// Link to the task, as the recipient sees the list (own or shared)
		$owner = (string)($params['owner'] ?? '');
		$calendarUri = (string)($params['calendarUri'] ?? '');
		$objectUri = (string)($params['objectUri'] ?? '');
		if ($calendarUri !== '' && $objectUri !== '') {
			$calendarId = $notification->getUser() === $owner ? $calendarUri : $calendarUri . '_shared_by_' . $owner;
			$notification->setLink($this->urlGenerator->linkToRouteAbsolute(Application::APP_ID . '.page.index')
				. 'calendars/' . rawurlencode($calendarId) . '/tasks/' . rawurlencode($objectUri));
		}
		$notification->setIcon($this->urlGenerator->getAbsoluteURL($this->urlGenerator->imagePath(Application::APP_ID, 'app-dark.svg')));
		return $notification;
	}
}
