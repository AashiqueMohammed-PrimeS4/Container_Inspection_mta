sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Filter, FilterOperator) => {
    "use strict";

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
                oDataModel.read("/InspectCodesSet", {
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
                                    resolve();
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
