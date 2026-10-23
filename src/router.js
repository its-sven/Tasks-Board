/**
 * Nextcloud - Tasks
 *
 * @author Raimund Schlüßler
 *
 * @copyright 2018 Raimund Schlüßler <raimund.schluessler@mailbox.org>
 *
 * This library is free software; you can redistribute it and/or
 * modify it under the terms of the GNU AFFERO GENERAL PUBLIC LICENSE
 * License as published by the Free Software Foundation; either
 * version 3 of the License, or any later version.
 *
 * This library is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU AFFERO GENERAL PUBLIC LICENSE for more details.
 *
 * You should have received a copy of the GNU Affero General Public
 * License along with this library. If not, see <http://www.gnu.org/licenses/>.
 *
 */

import { getInitialRoute } from './utils/router.js'
import AppSidebar from './views/AppSidebar.vue'
import Calendar from './tb/views/TbCalendarView.vue'
import Collections from './tb/views/TbCollectionsView.vue'
import TbDashboard from './tb/views/TbDashboard.vue'

import { getRootUrl, generateUrl } from '@nextcloud/router'

import { h } from 'vue'
import { createWebHistory, createRouter, RouterView } from 'vue-router'

const webRootWithIndexPHP = getRootUrl() + '/index.php'
const doesURLContainIndexPHP = window.location.pathname.startsWith(webRootWithIndexPHP)
// Tasks Board: the base follows the address the page was opened with. A server that
// serves /apps/… without index.php does not always report it (modRewriteWorking),
// generateUrl() would then add index.php and no route would match.
const base = doesURLContainIndexPHP
	? generateUrl('apps/' + appName, {}, { noRewrite: true })
	: getRootUrl() + '/apps/' + appName

const routes = [
	{ path: '/', redirect: getInitialRoute() },
	{
		path: '/collections/:collectionId',
		components: {
			default: { render: () => h(RouterView, { name: 'default' }) },
			AppSidebar: { render: () => h(RouterView, { name: 'AppSidebar' }) },
		},
		children: [
			{
				name: 'collections',
				path: '/collections/:collectionId',
				component: Collections,
				props: true,
			},
			{
				name: 'collectionsTask',
				path: '/collections/:collectionId/tasks/:taskId',
				components: { default: Collections, AppSidebar },
				props: { default: true, AppSidebar: true },
			},
			{
				name: 'collectionsParamTask',
				path: '/collections/:collectionId/:collectionParam/tasks/:taskId',
				components: { default: Collections, AppSidebar },
				props: { default: true, AppSidebar: true },
			},
		],
	},
	{
		path: '/calendars/:calendarId',
		components: {
			default: { render: () => h(RouterView, { name: 'default' }) },
			AppSidebar: { render: () => h(RouterView, { name: 'AppSidebar' }) },
		},
		children: [
			{
				name: 'calendars',
				path: '/calendars/:calendarId',
				component: Calendar,
				props: true,
			},
			{
				name: 'calendarsTask',
				path: '/calendars/:calendarId/tasks/:taskId',
				components: { default: Calendar, AppSidebar },
				props: { default: true, AppSidebar: true },
			},
		],
	},
	// Tasks Board: dashboard, tasks open in the sidebar
	{
		path: '/dashboard',
		components: {
			default: { render: () => h(RouterView, { name: 'default' }) },
			AppSidebar: { render: () => h(RouterView, { name: 'AppSidebar' }) },
		},
		children: [
			{
				name: 'dashboard',
				path: '/dashboard',
				component: TbDashboard,
			},
			{
				name: 'dashboardTask',
				path: '/dashboard/:calendarId/tasks/:taskId',
				components: { default: TbDashboard, AppSidebar },
				props: { default: false, AppSidebar: true },
			},
		],
	},
]

const router = createRouter({
	history: createWebHistory(base),
	routes,
})

export { routes }

export default router
