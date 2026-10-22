<?php
/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\TasksBoard\BackgroundJob;

use OCA\TasksBoard\Service\AssignmentService;
use OCP\AppFramework\Utility\ITimeFactory;
use OCP\BackgroundJob\TimedJob;
use Psr\Log\LoggerInterface;

/**
 * Hourly: reminds of follow-ups and tasks that are due today.
 * Each task is notified once per date.
 */
class FollowUpJob extends TimedJob {
	public function __construct(
		ITimeFactory $time,
		private AssignmentService $assignments,
		private LoggerInterface $logger,
	) {
		parent::__construct($time);
		$this->setInterval(3600);
		$this->setTimeSensitivity(self::TIME_SENSITIVE);
	}

	protected function run($argument): void {
		try {
			$sent = $this->assignments->notifyDueFollowUps();
			if ($sent > 0) {
				$this->logger->info('Sent ' . $sent . ' reminders', ['app' => 'tasks_board']);
			}
		} catch (\Throwable $e) {
			$this->logger->error('Reminders failed: ' . $e->getMessage(), ['app' => 'tasks_board', 'exception' => $e]);
		}
	}
}
