sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Get carrier type description from code
         * @param {array} aCarrierTypes - Carrier types array
         * @param {string} sCarrierTypeCode - Carrier type code
         * @returns {string} Carrier type description
         */
        getCarrierTypeDescription(aCarrierTypes, sCarrierTypeCode) {
            console.log("Getting carrier type description for code:", sCarrierTypeCode);
            console.log("Available carrier types:", aCarrierTypes);

            const oCarrierType = aCarrierTypes.find(item => item.CarrierTypeCode === sCarrierTypeCode);

            if (oCarrierType) {
                const description = oCarrierType.CarrierTypeCodeText;
                console.log("Found carrier type description:", description);
                return description || sCarrierTypeCode;
            }

            console.log("Carrier type not found, returning code:", sCarrierTypeCode);
            return sCarrierTypeCode;
        },

        /**
         * Get carrier line description from code
         * @param {array} aCarrierLines - Carrier lines array
         * @param {string} sCarrierLineCode - Carrier line code
         * @returns {string} Carrier line description
         */
        getCarrierLineDescription(aCarrierLines, sCarrierLineCode) {
            console.log("Getting carrier line description for code:", sCarrierLineCode);
            console.log("Available carrier lines:", aCarrierLines);

            const oCarrierLine = aCarrierLines.find(item => item.CarrierLineCode === sCarrierLineCode);

            if (oCarrierLine) {
                const description = oCarrierLine.CarrierLineCodeText;
                console.log("Found carrier line description:", description);
                return description || sCarrierLineCode;
            }

            console.log("Carrier line not found, returning code:", sCarrierLineCode);
            return sCarrierLineCode;
        }
    };
});
