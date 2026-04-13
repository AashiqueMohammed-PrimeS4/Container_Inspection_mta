/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["carrieranalytics/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
