sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Process inspection codes data
         * @param {array} aResults - Results from backend
         * @returns {object} Processed inspection codes data
         */
        processInspectionCodes(aResults) {
            if (!aResults || aResults.length === 0) {
                throw new Error("No inspection codes found in backend table");
            }

            const oDefectCodes = {};
            const aInspectionCodes = [];

            aResults.forEach((item) => {
                const sKey = item.InspectionCodeText;
                oDefectCodes[sKey] = false;
                aInspectionCodes.push({
                    key: sKey,
                    code: item.InspectionCode,
                    text: item.InspectionCodeText
                });
            });

            // Split into two columns
            const half = Math.ceil(aInspectionCodes.length / 2);
            const aInspectionCodesLeft = aInspectionCodes.slice(0, half);
            const aInspectionCodesRight = aInspectionCodes.slice(half);

            return {
                defectCodes: oDefectCodes,
                inspectionCodesLeft: aInspectionCodesLeft,
                inspectionCodesRight: aInspectionCodesRight
            };
        },

        /**
         * Build text to code mapping
         * @param {array} aInspectionCodesLeft - Left column codes
         * @param {array} aInspectionCodesRight - Right column codes
         * @returns {object} Text to code map
         */
        getTextToCodeMap(aInspectionCodesLeft, aInspectionCodesRight) {
            const aAllInspectionCodes = [...(aInspectionCodesLeft || []), ...(aInspectionCodesRight || [])];

            const textToCodeMap = {};
            aAllInspectionCodes.forEach(item => {
                textToCodeMap[item.text] = item.code;
            });
            return textToCodeMap;
        },

        /**
         * Build selected codes array for backend
         * @param {object} oDefectCodes - Defect codes object
         * @param {object} textToCodeMap - Text to code mapping
         * @param {string} sDocument - Document number
         * @param {string} sSequence - Sequence number
         * @param {string} sCarrier - Carrier number
         * @returns {array} Array of selected codes
         */
        buildSelectedCodes(oDefectCodes, textToCodeMap, sDocument, sSequence, sCarrier) {
            const oCurrentDate = new Date();
            const aSelectedCodes = [];
            let iSeq = 1;

            Object.keys(oDefectCodes).forEach(sKey => {
                if (oDefectCodes[sKey]) {
                    const sCodeValue = textToCodeMap[sKey];
                    if (!sCodeValue) {
                        console.error("Could not find code for text:", sKey);
                        return;
                    }
                    aSelectedCodes.push({
                        Document: sDocument,
                        Sequencenumber: sSequence,
                        CarrierNumber: sCarrier,
                        InspectionDate: `/Date(${oCurrentDate.getTime()})/`,
                        CodeSeq: iSeq.toString().padStart(2, '0'),
                        CodeValue: sCodeValue,
                        CodeText: sKey,
                        CreatedOn: `/Date(${oCurrentDate.getTime()})/`,
                        CreatedBy: "USER"
                    });
                    iSeq++;
                }
            });

            return aSelectedCodes;
        },

        /**
         * Create deep entity payload
         * @param {array} aSelectedCodes - Selected codes array
         * @param {string} sStatus - Status (A/R)
         * @param {string} sDocument - Document number
         * @param {string} sSequence - Sequence number
         * @param {string} sCarrier - Carrier number
         * @param {string} sCarrierLine - Carrier line code
         * @param {string} sCarrierType - Carrier type code
         * @returns {object} Deep entity payload
         */
        createDeepEntityPayload(aSelectedCodes, sStatus, sDocument, sSequence, sCarrier, sCarrierLine, sCarrierType) {
            const oCurrentDate = new Date();
            return {
                Document: sDocument,
                Sequencenumber: sSequence,
                CarrierNumber: sCarrier,
                CarrierLineCode: sCarrierLine,
                CarrierTyCode: sCarrierType,
                InspectionDate: `/Date(${oCurrentDate.getTime()})/`,
                Status: sStatus,
                HasBeforeImg: false,
                HasAfterImg: false,
                CreatedBy: "USER",
                CreatedOn: `/Date(${oCurrentDate.getTime()})/`,
                ChangedBy: "USER",
                ChangedOn: `/Date(${oCurrentDate.getTime()})/`,
                np_on_Codes: aSelectedCodes
            };
        },

        /**
         * Reset all defect codes to unchecked
         * @param {object} oDefectCodes - Defect codes object
         * @returns {object} Reset defect codes
         */
        resetDefectCodes(oDefectCodes) {
            const resetCodes = { ...oDefectCodes };
            Object.keys(resetCodes).forEach(sKey => {
                resetCodes[sKey] = false;
            });
            return resetCodes;
        }
    };
});
