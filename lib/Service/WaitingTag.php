<?php
/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\TasksBoard\Service;

use OCA\TasksBoard\AppInfo\Application;
use OCP\IConfig;

/**
 * The tag that marks a task as waiting (the follow-up date is the start date).
 * Administrators can change it; without a setting it depends on the default
 * language of the instance ("wartet" for German, "waiting" otherwise).
 */
final class WaitingTag {
	public const CONFIG_KEY = 'waiting_tag';
	public const MAX_LENGTH = 100;

	/**
	 * @return string The waiting tag in use
	 */
	public static function get(IConfig $config): string {
		$tag = self::normalize((string)$config->getAppValue(Application::APP_ID, self::CONFIG_KEY, ''));
		return $tag !== '' ? $tag : self::defaultTag($config);
	}

	/**
	 * @return string The waiting tag that is used when none is set
	 */
	public static function defaultTag(IConfig $config): string {
		$language = strtolower((string)$config->getSystemValue('default_language', ''));
		return str_starts_with($language, 'de') ? 'wartet' : 'waiting';
	}

	/**
	 * Saves the waiting tag. An empty tag goes back to the default.
	 *
	 * @return string The waiting tag in use
	 */
	public static function set(IConfig $config, string $tag): string {
		$tag = self::normalize($tag);
		if ($tag === '' || $tag === self::defaultTag($config)) {
			$config->deleteAppValue(Application::APP_ID, self::CONFIG_KEY);
		} else {
			$config->setAppValue(Application::APP_ID, self::CONFIG_KEY, $tag);
		}
		return self::get($config);
	}

	/**
	 * Cleans a tag like the tag list does: no commas, single spaces, limited length
	 */
	public static function normalize(string $tag): string {
		return mb_substr(trim((string)preg_replace('/\s+/u', ' ', str_replace(',', ' ', $tag))), 0, self::MAX_LENGTH);
	}
}
