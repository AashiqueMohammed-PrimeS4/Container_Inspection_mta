sap.ui.define([], () => {
    "use strict";

    return {
        /**
         * Get current user from SAP system
         * @param {sap.ui.model.odata.v2.ODataModel} oModel - OData model (optional)
         * @returns {string} Current user ID
         */
        getCurrentUser(oModel) {
            try {
                if (sap.ushell && sap.ushell.Container) {
                    const oUserInfo = sap.ushell.Container.getService("UserInfo");
                    return oUserInfo.getId();
                }
            } catch (error) {
                console.warn("UserInfo service not available:", error);
            }

            if (oModel) {
                try {
                    const oHeaders = oModel.getHeaders();
                    if (oHeaders && oHeaders["sap-client"]) {
                        return oHeaders["x-user"] || "SYSTEM_USER";
                    }
                } catch (error) {
                    console.warn("Unable to get user from model:", error);
                }
            }

            return "UNKNOWN_USER";
        }
    };
});
