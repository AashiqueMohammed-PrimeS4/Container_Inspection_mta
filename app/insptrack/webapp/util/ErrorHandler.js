sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Parse error message from OData error response
         * @param {object} oError - Error object from OData call
         * @returns {string} Parsed error message
         */
        parseErrorMessage(oError) {
            let sErrorMessage = "Operation failed";
            if (oError.responseText) {
                try {
                    const oErrorResponse = JSON.parse(oError.responseText);
                    if (oErrorResponse.error && oErrorResponse.error.message) {
                        sErrorMessage = oErrorResponse.error.message.value || oErrorResponse.error.message;
                    }
                } catch (e) {
                    sErrorMessage = oError.responseText;
                }
            } else if (oError.message) {
                sErrorMessage = oError.message;
            }
            return sErrorMessage;
        }
    };
});
