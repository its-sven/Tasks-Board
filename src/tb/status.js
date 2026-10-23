/**
 * SPDX-FileCopyrightText: 2026 Sven Würth
 * SPDX-License-Identifier: AGPL-3.0-or-later
 */

import CheckCircle from 'vue-material-design-icons/CheckCircle.vue'
import CircleHalfFull from 'vue-material-design-icons/CircleHalfFull.vue'
import CircleOutline from 'vue-material-design-icons/CircleOutline.vue'
import CloseCircleOutline from 'vue-material-design-icons/CloseCircleOutline.vue'
import TimerSandEmpty from 'vue-material-design-icons/TimerSandEmpty.vue'

/**
 * The five states of a task, in the order of the board columns.
 * The key is the board column (see boardColumn() in waiting.js).
 */
export const STATUS = {
	open: { label: 'Open', icon: CircleOutline },
	inProgress: { label: 'In progress', icon: CircleHalfFull },
	waiting: { label: 'Waiting', icon: TimerSandEmpty },
	done: { label: 'Done', icon: CheckCircle },
	cancelled: { label: 'Cancelled', icon: CloseCircleOutline },
}
