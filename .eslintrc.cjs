module.exports = {
	globals: {
		t: false,
		n: false,
		OC: false,
		OCA: false,
		moment: true,
		appVersion: true,
		appName: true,
	},
	extends: [
		'@nextcloud/eslint-config/vue3',
	],
};
