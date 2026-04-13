/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["insptrack/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
