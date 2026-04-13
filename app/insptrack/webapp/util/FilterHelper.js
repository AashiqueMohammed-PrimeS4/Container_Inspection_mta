sap.ui.define([
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Filter, FilterOperator) => {
    "use strict";

    return {
        /**
         * Create header filters for inspection queries
         * @param {string} sDocument - Document number
         * @param {string} sSequence - Sequence number
         * @param {string} sCarrier - Carrier number
         * @returns {array} Array of filters
         */
        createHeaderFilters(sDocument, sSequence, sCarrier) {
            return [
                new Filter("Document", FilterOperator.EQ, sDocument),
                new Filter("Sequencenumber", FilterOperator.EQ, sSequence),
                new Filter("CarrierNumber", FilterOperator.EQ, sCarrier)
            ];
        }
    };
});
