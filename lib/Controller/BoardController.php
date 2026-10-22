<?php
/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\TasksBoard\Controller;

use OCA\TasksBoard\Service\AssignmentService;
use OCA\TasksBoard\Service\WaitingTag;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IConfig;
use OCP\IRequest;

/**
 * API for the assignment of tasks, the fixed tag list and the waiting tag
 */
class BoardController extends Controller {
	public function __construct(
		string $appName,
		IRequest $request,
		private AssignmentService $assignments,
		private IConfig $config,
		private ?string $userId,
	) {
		parent::__construct($appName, $request);
	}

	/**
	 * Persons a task of this list can be assigned to
	 *
	 * @param string $calendarId List id as in the app URL
	 */
	#[NoAdminRequired]
	public function assignees(string $calendarId): JSONResponse {
		if ($this->userId === null) {
			return new JSONResponse(['status' => 'error', 'message' => 'not logged in'], Http::STATUS_UNAUTHORIZED);
		}
		$calendar = $this->assignments->resolveCalendar($this->userId, $calendarId);
		if ($calendar === null) {
			return new JSONResponse(['status' => 'error', 'message' => 'list not found'], Http::STATUS_NOT_FOUND);
		}
		return new JSONResponse(['status' => 'success', 'data' => $this->assignments->getAssignees($calendar)]);
	}

	/**
	 * Sends a notification after a task was assigned or completed.
	 * The server checks the stored task, so nobody can send arbitrary notifications.
	 *
	 * @param string $type assigned or completed
	 * @param string $calendarId List id as in the app URL
	 * @param string $taskUri File name of the task
	 */
	#[NoAdminRequired]
	public function notify(string $type, string $calendarId, string $taskUri): JSONResponse {
		if ($this->userId === null) {
			return new JSONResponse(['status' => 'error', 'message' => 'not logged in'], Http::STATUS_UNAUTHORIZED);
		}
		return new JSONResponse(['status' => 'success', 'data' => $this->assignments->notify($this->userId, $type, $calendarId, $taskUri)]);
	}

	/**
	 * Saves the fixed tag list. No #[NoAdminRequired]: only administrators may do this.
	 *
	 * @param mixed $tags The tags (list of strings)
	 */
	public function setTagList($tags = []): JSONResponse {
		if (!is_array($tags)) {
			return new JSONResponse(['status' => 'error', 'message' => 'tags must be a list'], Http::STATUS_BAD_REQUEST);
		}
		$list = [];
		$seen = [];
		foreach ($tags as $tag) {
			if (!is_string($tag)) {
				continue;
			}
			$tag = mb_substr(trim((string)preg_replace('/\s+/u', ' ', str_replace(',', ' ', $tag))), 0, 100);
			$key = mb_strtolower($tag);
			if ($tag === '' || isset($seen[$key])) {
				continue;
			}
			$seen[$key] = true;
			$list[] = $tag;
			if (count($list) >= 300) {
				break;
			}
		}
		$this->config->setAppValue($this->appName, 'tag_list', json_encode($list, JSON_UNESCAPED_UNICODE));
		return new JSONResponse(['status' => 'success', 'data' => $list]);
	}

	/**
	 * Saves the waiting tag. No #[NoAdminRequired]: only administrators may do this.
	 * An empty tag goes back to the default of the instance.
	 *
	 * @param mixed $tag The tag
	 */
	public function setWaitingTag($tag = ''): JSONResponse {
		if (!is_string($tag)) {
			return new JSONResponse(['status' => 'error', 'message' => 'tag must be a string'], Http::STATUS_BAD_REQUEST);
		}
		return new JSONResponse(['status' => 'success', 'data' => WaitingTag::set($this->config, $tag)]);
	}
}
