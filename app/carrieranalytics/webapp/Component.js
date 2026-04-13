sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "carrieranalytics/model/models"
], (UIComponent, JSONModel,models) => {
    "use strict";

    return UIComponent.extend("carrieranalytics.Component", {
        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init() {
            // call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // set the device model
            this.setModel(models.createDeviceModel(), "device");

            // Create a shared data model for passing data between controllers
            var oSharedDataModel = new JSONModel({
                aiSummaryStartDate: null,
                aiSummaryEndDate: null
            });
            this.setModel(oSharedDataModel, "sharedData");
            // enable routing
            this.getRouter().initialize();
        }
    });
});