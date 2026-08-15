sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/odata/v2/ODataModel"
], (Filter, FilterOperator, ODataModel) => {
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

    /**
     * Extract the backend-raised message (e.g. usage % warning) from the
     * sap-message response header, if present
     * @param {object} oResponse - response object passed to a model success callback
     * @returns {string|null} message text, or null if no sap-message header was sent
     */
    function extractSapMessage(oResponse) {
        const sHeader = oResponse && oResponse.headers && oResponse.headers["sap-message"];
        if (!sHeader) {
            return null;
        }
        try {
            return JSON.parse(sHeader).message || null;
        } catch (e) {
            console.error("Failed to parse sap-message header:", e);
            return null;
        }
    }

    return {
        /**
         * Load carrier lines from backend
         * @param {sap.ui.model.odata.v2.ODataModel} oDataModel - OData model
         * @returns {Promise} Promise resolving with carrier lines data
         */
        loadCarrierLines(oDataModel) {
            return new Promise((resolve, reject) => {
                console.log("Loading Carrier Lines...");
                oDataModel.read("/VH_CarrierlineSet", {
                    success: (oData) => {
                        console.log("Carrier lines Loaded Successfully:", oData.results);
                        resolve(oData.results);
                    },
                    error: (oError) => {
                        console.error("Error loading carrier lines:", oError);
                        reject(oError);
                    }
                });
            });
        },

        /**
         * Load carrier types from backend
         * @param {sap.ui.model.odata.v2.ODataModel} oDataModel - OData model
         * @returns {Promise} Promise resolving with carrier types data
         */
        loadCarrierTypes(oDataModel) {
            return new Promise((resolve, reject) => {
                console.log("Loading Carrier Types...");
                oDataModel.read("/VH_CarrierTypeSet", {
                    success: (oData) => {
                        console.log("Carrier types Loaded Successfully:", oData.results);
                        resolve(oData.results);
                    },
                    error: (oError) => {
                        console.error("Error loading carrier types:", oError);
                        reject(oError);
                    }
                });
            });
        },

        /**
         * Load inspection codes from backend
         * @param {sap.ui.model.odata.v2.ODataModel} oDataModel - OData model
         * @returns {Promise} Promise resolving with inspection codes data
         */
        loadInspectionCodes(oDataModel) {
            return new Promise((resolve, reject) => {
                console.log("=== LOADING INSPECTION CODES ===");
                oDataModel.read("/InspectCodeSet", {
                    success: (oData) => {
                        console.log("SUCCESS - Inspection codes loaded");
                        if (!oData.results || oData.results.length === 0) {
                            console.error("Backend returned empty results!");
                            reject(new Error("No inspection codes found in backend table"));
                            return;
                        }
                        resolve(oData.results);
                    },
                    error: (oError) => {
                        console.error("Error loading inspection codes:", oError);
                        reject(oError);
                    }
                });
            });
        },

        /**
         * Check if inspection record exists
         * @param {sap.ui.model.odata.v2.ODataModel} oDataModel - OData model
         * @param {string} sDocument - Document number
         * @param {string} sSequence - Sequence number
         * @param {string} sCarrier - Carrier number
         * @returns {Promise} Promise resolving with record data or null
         */
        checkRecordExists(oDataModel, sDocument, sSequence, sCarrier) {
            return new Promise((resolve, reject) => {
                console.log("Checking record existence for:", sDocument, sSequence, sCarrier);

                const aFilters = [
                    new Filter("Document", FilterOperator.EQ, sDocument),
                    new Filter("Sequencenumber", FilterOperator.EQ, sSequence),
                    new Filter("CarrierNumber", FilterOperator.EQ, sCarrier)
                ];

                oDataModel.read("/InspectionHeaderSet", {
                    filters: aFilters,
                    success: (oData) => {
                        console.log("Record check response:", oData);
                        if (oData.results && oData.results.length > 0) {
                            resolve(oData.results[0]);
                        } else {
                            resolve(null);
                        }
                    },
                    error: (oError) => {
                        console.error("Error checking record existence:", oError);
                        reject(oError);
                    }
                });
            });
        },

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
                        // Force a live round-trip every time - never let the browser or an
                        // intermediate proxy serve back a stale cached license entity
                        urlParameters: ["_=" + Date.now()],
                        headers: {
                            "Cache-Control": "no-cache, no-store, must-revalidate",
                            "Pragma": "no-cache"
                        },
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
        },

        /**
         * Save inspection codes with deep create
         * @param {sap.ui.model.odata.v2.ODataModel} oDataModel - OData model
         * @param {object} oDeepEntityData - Deep entity payload
         * @returns {Promise} Promise resolving with created data
         */
        saveInspectionCodes(oDataModel, oDeepEntityData) {
            return new Promise((resolve, reject) => {
                console.log("Deep Entity Data Structure:");
                console.log(JSON.stringify(oDeepEntityData, null, 2));

                oDataModel.create("/InspectionHeaderSet", oDeepEntityData, {
                    success: (oData) => {
                        console.log("SUCCESS: CREATE_DEEP_ENTITY called!");
                        console.log("Response data:", oData);
                        resolve(oData);
                    },
                    error: (oError) => {
                        console.error("ERROR: CREATE_DEEP_ENTITY failed");
                        console.error("Error object:", oError);
                        reject(oError);
                    }
                });
            });
        },

        /**
         * Fetch inspection data with codes
         * @param {sap.ui.model.odata.v2.ODataModel} oDataModel - OData model
         * @param {array} aFilters - Array of filters
         * @returns {Promise} Promise resolving with inspection data
         */
        fetchInspectionData(oDataModel, aFilters) {
            return new Promise((resolve) => {
                oDataModel.read("/InspectionHeaderSet", {
                    filters: aFilters,
                    urlParameters: {
                        "$expand": "np_on_Codes"
                    },
                    success: (oData) => {
                        if (oData.results && oData.results.length > 0) {
                            const oRecord = oData.results[0];
                            const aInspectionCodes = oRecord.np_on_Codes?.results || [];
                            const sStatus = oRecord.Status;

                            resolve({
                                status: sStatus,
                                codes: aInspectionCodes
                            });
                        } else {
                            resolve({
                                status: "",
                                codes: []
                            });
                        }
                    },
                    error: (oError) => {
                        console.error("Error fetching inspection data:", oError);
                        resolve({
                            status: "",
                            codes: []
                        });
                    }
                });
            });
        },

        /**
         * Update header flags after image upload
         * @param {sap.ui.model.odata.v2.ODataModel} oDataModel - OData model
         * @param {array} aFilters - Array of filters
         * @param {string} imageType - Image type (B/A)
         * @returns {Promise} Promise resolving when update is complete
         */
        updateHeaderFlags(oDataModel, aFilters, imageType) {
            return new Promise((resolve, reject) => {
                console.log("=== UPDATING HEADER FLAGS ===");

                oDataModel.read("/InspectionHeaderSet", {
                    filters: aFilters,
                    success: (oData) => {
                        if (oData.results && oData.results.length > 0) {
                            const oRecord = oData.results[0];

                            const oUpdateData = {
                                ChangedBy: "USER",
                                ChangedOn: new Date()
                            };

                            if (imageType === "B") {
                                oUpdateData.HasBeforeImg = true;
                            } else {
                                oUpdateData.HasAfterImg = true;
                            }

                            const sKey = oDataModel.createKey("/InspectionHeaderSet", {
                                Document: oRecord.Document,
                                Sequencenumber: oRecord.Sequencenumber,
                                CarrierNumber: oRecord.CarrierNumber,
                                InspectionDate: oRecord.InspectionDate
                            });

                            oDataModel.update(sKey, oUpdateData, {
                                success: () => {
                                    console.log("Header flags updated successfully");
                                    resolve(oRecord);
                                },
                                error: (oError) => {
                                    console.error("Failed to update header flags:", oError);
                                    reject(oError);
                                }
                            });
                        } else {
                            console.error("Cannot find inspection record to update");
                            reject(new Error("Cannot find inspection record to update"));
                        }
                    },
                    error: (oError) => {
                        console.error("Error reading header:", oError);
                        reject(oError);
                    }
                });
            });
        },

        /**
         * Update license usage balance for an inspection (increments inspections_used
         * on the backend based on the header's Status/HasAfterImg)
         * @param {sap.ui.model.odata.v2.ODataModel} oDataModel - OData model
         * @param {string} sDocument - Document number
         * @param {string} sSequence - Sequence number
         * @param {string} sCarrier - Carrier number
         * @param {Date} dInspectionDate - Inspection date (key)
         * @returns {Promise} Promise resolving when usage update is complete
         */
        updateUsage(oDataModel, sDocument, sSequence, sCarrier, dInspectionDate) {
            return new Promise((resolve, reject) => {
                // main model's metadata is already loaded - use it to build the key
                const sKey = oDataModel.createKey("/SI_UsageSet", {
                    Document: sDocument,
                    Sequencenumber: sSequence,
                    CarrierNumber: sCarrier,
                    InspectionDate: dInspectionDate
                });

                const oModel = getNonBatchModel(oDataModel);
                oModel.metadataLoaded().then(() => {
                    // backend logic only reads the keys and ignores the body.
                    // merge:false forces PUT instead of MERGE, so Gateway calls UPDATE_ENTITY
                    // directly instead of first doing an implicit GET_ENTITY (not implemented
                    // for this write-only entity) to compute the merge.
                    oModel.update("/" + sKey, {}, {
                        merge: false,
                        success: (oData, oResponse) => {
                            console.log("Usage updated successfully");
                            console.log("oResponse",oResponse);
                            resolve(extractSapMessage(oResponse));
                        },
                        error: (oError) => {
                            console.error("Failed to update usage:", oError);
                            reject(oError);
                        }
                    });
                }).catch(reject);
            });
        },

        /**
         * Upload PDF to backend
         * @param {sap.ui.model.odata.v2.ODataModel} oDataModel - OData model
         * @param {Blob} pdfBlob - PDF blob
         * @param {string} slug - File slug
         * @returns {Promise} Promise resolving when upload is complete
         */
        async uploadPDF(oDataModel, pdfBlob, slug) {
            try {
                const sCSRFToken = await oDataModel.securityTokenAvailable();
                console.log("pdfBlob",pdfBlob);

                const sUrl = oDataModel.sServiceUrl + "/AttachmentSet";

                return new Promise((resolve, reject) => {
                    $.ajax({
                        url: sUrl,
                        type: "POST",
                        data: pdfBlob,
                        processData: false,
                        contentType: "application/pdf",
                        headers: {
                            "X-CSRF-Token": sCSRFToken,
                            "slug": slug,
                            "X-Requested-With": "XMLHttpRequest"
                        },
                        success: resolve,
                        error: reject
                    });
                });

            } catch (err) {
                console.error("Token fetch failed", err);
                throw err;
            }
        }
    };
});
