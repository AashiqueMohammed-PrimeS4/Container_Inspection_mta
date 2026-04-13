sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Validate Step 1 (Document Details)
         * @param {object} oData - Data object containing form values
         * @param {boolean} showCarrierLineCombo - Whether carrier line combo is visible
         * @param {boolean} showCarrierTypeCombo - Whether carrier type combo is visible
         * @returns {boolean} True if valid, false otherwise
         */
        validateStep1(oData, showCarrierLineCombo, showCarrierTypeCombo) {
            const { document, sequenceNumber, carrierNumber, carrierLine, carrierType } = oData;

            // Check if all required fields are filled (trim to handle spaces)
            const bAllRequiredFieldsFilled =
                (document && document.trim().length > 0) &&
                (sequenceNumber && sequenceNumber.trim().length > 0) &&
                (carrierNumber && carrierNumber.trim().length > 0) &&
                (showCarrierLineCombo ? (carrierLine && carrierLine.trim().length > 0) : true) &&
                (showCarrierTypeCombo ? (carrierType && carrierType.trim().length > 0) : true);

            return bAllRequiredFieldsFilled;
        },

        /**
         * Validate that first 3 fields are filled
         * @param {string} sDocument - Document number
         * @param {string} sSequence - Sequence number
         * @param {string} sCarrier - Carrier number
         * @returns {boolean} True if all 3 fields filled
         */
        validateFirst3Fields(sDocument, sSequence, sCarrier) {
            return (sDocument && sDocument.length > 0) &&
                   (sSequence && sSequence.length > 0) &&
                   (sCarrier && sCarrier.length > 0);
        },

        /**
         * Validate that at least one defect code is selected
         * @param {object} oDefectCodes - Object with defect codes and their selection status
         * @returns {boolean} True if at least one is selected
         */
        validateDefectCodes(oDefectCodes) {
            return Object.values(oDefectCodes).some(val => val === true);
        },

        /**
         * Validate image count
         * @param {number} count - Current image count
         * @param {number} max - Maximum allowed (default 6)
         * @returns {boolean} True if count is within limit
         */
        validateImageCount(count, max = 6) {
            return count < max;
        },

        /**
         * Check if codes have already been saved
         * @param {array} aCurrentSelectedCodes - Currently selected codes
         * @param {array} aSavedCodes - Previously saved codes
         * @returns {boolean} True if codes match
         */
        areCodesSaved(aCurrentSelectedCodes, aSavedCodes) {
            if (aSavedCodes.length === 0) return false;

            const currentSorted = aCurrentSelectedCodes.sort().join(",");
            const savedSorted = aSavedCodes.sort().join(",");

            return currentSorted === savedSorted;
        }
    };
});
