<?php
/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

namespace OCA\TasksBoard\Tests\Unit\Service;

use OCA\TasksBoard\Service\WaitingTag;
use OCP\IConfig;
use PHPUnit\Framework\TestCase;

class WaitingTagTest extends TestCase {
	private function config(string $language, string $stored = ''): IConfig {
		$config = $this->createMock(IConfig::class);
		$config->method('getSystemValue')->willReturnMap([
			['default_language', '', $language],
		]);
		$config->method('getAppValue')->willReturnMap([
			['tasks_board', 'waiting_tag', '', $stored],
		]);
		return $config;
	}

	public function testDefaultDependsOnLanguage(): void {
		$this->assertSame('wartet', WaitingTag::get($this->config('de')));
		$this->assertSame('wartet', WaitingTag::get($this->config('de_DE')));
		$this->assertSame('waiting', WaitingTag::get($this->config('en')));
		$this->assertSame('waiting', WaitingTag::get($this->config('')));
	}

	public function testStoredTagWins(): void {
		$this->assertSame('on hold', WaitingTag::get($this->config('de', '  on   hold ')));
	}

	public function testNormalize(): void {
		$this->assertSame('a b c', WaitingTag::normalize(" a,b \t c "));
		$this->assertSame(100, mb_strlen(WaitingTag::normalize(str_repeat('ä', 150))));
	}

	public function testSetStoresOrResets(): void {
		$config = $this->config('de');
		$config->expects($this->once())->method('setAppValue')->with('tasks_board', 'waiting_tag', 'on hold');
		WaitingTag::set($config, ' on hold ');

		$config = $this->config('de');
		$config->expects($this->never())->method('setAppValue');
		$config->expects($this->exactly(2))->method('deleteAppValue')->with('tasks_board', 'waiting_tag');
		WaitingTag::set($config, '');
		WaitingTag::set($config, 'wartet');
	}
}
