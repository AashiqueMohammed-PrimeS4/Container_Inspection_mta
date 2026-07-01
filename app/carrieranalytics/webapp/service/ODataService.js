sap.ui.define([
    "sap/ui/model/odata/v2/ODataModel"
], (ODataModel) => {
    "use strict";

    let oNonBatchModel;

    /**
     * Non-batched model instance for entities whose backend redefinition
     * only supports plain GET, not requests wrapped inside $batch
     * @param {sap.ui.model.odata.v2.ODataModel} oDataModel - main OData model (used for its service URL)
     * @returns {sap.ui.model.odata.v2.ODataModel} non-batched model
     */
    function getNonBatchModel(oDataModel) {
        if (!oNonBatchModel) {
            oNonBatchModel = new ODataModel(oDataModel.sServiceUrl, {
                useBatch: false
            });
        }
        return oNonBatchModel;
    }

    return {
        /**
         * Check whether the active license entitles the org to a given module
         * @param {sap.ui.model.odata.v2.ODataModel} oDataModel - OData model
         * @param {string} sModuleField - License module flag to check (e.g. "OcrModule", "PrivaModule")
         * @returns {Promise<boolean>} Promise resolving with true/false entitlement
         */
        checkLicenseModule(oDataModel, sModuleField) {
            return new Promise((resolve, reject) => {
                // main model's metadata is already loaded - use it to build the key
                const sKey = oDataModel.createKey("/SI_LicenseSet", {
                    InspectionDate: new Date()
                });

                const oModel = getNonBatchModel(oDataModel);
                oModel.metadataLoaded().then(() => {
                    oModel.read("/" + sKey, {
                        success: (oData) => {
                            console.log("License check response:", oData);
                            resolve(!!oData[sModuleField]);
                        },
                        error: (oError) => {
                            console.error("Error checking license module:", oError);
                            reject(oError);
                        }
                    });
                }).catch(reject);
            });
        }
    };
});
