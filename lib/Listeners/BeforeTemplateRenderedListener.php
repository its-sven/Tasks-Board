<?php
/**
 * @copyright Copyright (c) 2021 Jakob Röhrl <jakob.roehrl@web.de>
 *
 * @author Julius Härtl <jus@bitgrid.net>
 * @author Jakob Röhrl <jakob.roehrl@web.de>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */

declare(strict_types=1);


namespace OCA\TasksBoard\Listeners;

use OCA\TasksBoard\AppInfo\Application;
use OCP\AppFramework\Http\Events\BeforeTemplateRenderedEvent;
use OCP\EventDispatcher\Event;
use OCP\EventDispatcher\IEventListener;
use OCP\IConfig;
use OCP\IRequest;
use OCP\IUserSession;
use OCP\Util;

class BeforeTemplateRenderedListener implements IEventListener {
	private $request;
	// Tasks Board: for the preference of the Calendar app (see opensFromCalendar)
	private $config;
	private $userSession;

	public function __construct(IRequest $request, IConfig $config, IUserSession $userSession) {
		$this->request = $request;
		$this->config = $config;
		$this->userSession = $userSession;
	}

	public function handle(Event $event): void {
		if (!($event instanceof BeforeTemplateRenderedEvent)) {
			return;
		}

		if (!$event->isLoggedIn()) {
			return;
		}

		$pathInfo = $this->request->getPathInfo();
		if (strpos($pathInfo, '/call/') === 0 || strpos($pathInfo, '/apps/spreed') === 0) {
			Util::addScript(Application::APP_ID, Application::APP_ID . '-talk');
			Util::addStyle(Application::APP_ID, Application::APP_ID . '-talk');
			Util::addStyle(Application::APP_ID, 'tasks-icon');
		}

		// Tasks Board: a click on a task in the Calendar app opens it in Tasks Board
		if (strpos($pathInfo, '/apps/calendar') === 0 && $this->opensFromCalendar()) {
			Util::addScript(Application::APP_ID, Application::APP_ID . '-calendar');
		}
	}

	/**
	 * Tasks Board: preference "Open tasks from the Calendar app in Tasks Board" (default: yes)
	 *
	 * @return bool
	 */
	private function opensFromCalendar(): bool {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return false;
		}
		$prefs = json_decode((string)$this->config->getUserValue($user->getUID(), Application::APP_ID, 'various_tbPrefs', '{}'), true);
		return !is_array($prefs) || !array_key_exists('openFromCalendar', $prefs) || $prefs['openFromCalendar'] !== false;
	}
}
