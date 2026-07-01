sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ushell/Container",
    "carrieranalytics/service/ODataService"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, Container, ODataService) {
    "use strict";

    return Controller.extend("carrieranalytics.controller.Main", {

        /**
         * Controller initialization
         * Sets up view models, cache structures, and DateRangePicker auto-close behavior
         * Automatically loads data for current date
         */
        onInit: function () {
            // Initialize view model
            var oViewModel = new JSONModel({
                // Date range tile properties
                acceptedCount: 0,
                rejectedCount: 0,
                selectedStartDate: null,
                selectedEndDate: null,

                isLoading: false
            });
            this.getView().setModel(oViewModel, "viewModel");
            const oChatModel = new JSONModel({
                messages: [],
                userName: "User"
            });
            this._loadUserInfo();
            this.getView().setModel(oChatModel, "chatModel");


            // Configure DateRangeSelection to auto-close after date selection and set current date
            this.getView().attachAfterRendering(function () {
                var oDateRangePicker = this.byId("inspectionDateRangePicker");
                if (oDateRangePicker && !oDateRangePicker._bCalendarAttached) {
                    oDateRangePicker._bCalendarAttached = true;

                    var fnOriginalSelect = oDateRangePicker._handleCalendarSelect;
                    oDateRangePicker._handleCalendarSelect = function () {
                        fnOriginalSelect.apply(this, arguments);
                        // Close picker after both dates are selected
                        if (this.getDateValue() && this.getSecondDateValue()) {
                            this.closePicker();
                        }
                    };

                    // Set current date as default range (single day)
                    var oCurrentDate = new Date();
                    oDateRangePicker.setDateValue(oCurrentDate);
                    oDateRangePicker.setSecondDateValue(oCurrentDate);

                    // Store the selected dates in view model
                    oViewModel.setProperty("/selectedStartDate", oCurrentDate);
                    oViewModel.setProperty("/selectedEndDate", oCurrentDate);

                    // Fetch data for current date
                    this._fetchStatusCounts(oCurrentDate, oCurrentDate);
                }
            }.bind(this));
        },


        /**
         * Handler for main date range picker change event
         * Fetches inspection counts for the selected date range
         * @param {sap.ui.base.Event} oEvent - The date range change event
         */
        onDateRangeChangeMain: function (oEvent) {
            var oDateRangePicker = oEvent.getSource();
            var oStartDate = oDateRangePicker.getDateValue();
            var oEndDate = oDateRangePicker.getSecondDateValue();

            if (oStartDate && oEndDate) {
                // Store selected dates in view model for navigation
                var oViewModel = this.getView().getModel("viewModel");
                oViewModel.setProperty("/selectedStartDate", oStartDate);
                oViewModel.setProperty("/selectedEndDate", oEndDate);

                this._fetchStatusCounts(oStartDate, oEndDate);
            } else {
                // Reset counts when date range is cleared
                var oViewModel = this.getView().getModel("viewModel");
                oViewModel.setProperty("/acceptedCount", 0);
                oViewModel.setProperty("/rejectedCount", 0);
                oViewModel.setProperty("/selectedStartDate", null);
                oViewModel.setProperty("/selectedEndDate", null);
            }
        },

        /**
         * Format date as YYYY-MM-DD string to avoid timezone issues
         * This ensures the date sent to backend is exactly what user selected
         * @param {Date} oDate - The date to format
         * @returns {string} Formatted date string (YYYY-MM-DD)
         */
        _formatDateForOData: function (oDate) {
            
            var sYear = oDate.getFullYear();
            
            var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
          
            var sDay = ("0" + oDate.getDate()).slice(-2);
            
            console.log(sYear + "-" + sMonth + "-" + sDay);
            return sYear + "-" + sMonth + "-" + sDay;

        },

        /**
         * Fetch counts for both accepted and rejected statuses for a date range
         * @param {Date} oStartDate - The start date of the range
         * @param {Date} oEndDate - The end date of the range
         */
        _fetchStatusCounts: function (oStartDate, oEndDate) {
            var oModel = this.getView().getModel();
            var sPath = "/InspectionHeaderSet";
            var sFormattedStartDate = this._formatDateForOData(oStartDate);
            var sFormattedEndDate = this._formatDateForOData(oEndDate);
            
            var aFilters = [
                new Filter("InspectionDate", FilterOperator.BT, sFormattedStartDate, sFormattedEndDate)
            ];

            oModel.read(sPath, {
                filters: aFilters,
                success: function (oData) {
                    var iAcceptedCount = 0;
                    var iRejectedCount = 0;
                    if (oData.results) {
                        oData.results.forEach(function (oItem) {
                            if (oItem.Status === "A") {
                                iAcceptedCount++;
                            } else if (oItem.Status === "R") {
                                iRejectedCount++;
                            }
                        });
                    }
                    var oViewModel = this.getView().getModel("viewModel");
                    oViewModel.setProperty("/acceptedCount", iAcceptedCount);
                    oViewModel.setProperty("/rejectedCount", iRejectedCount);
                }.bind(this),
                error: function (oError) {
                    console.error("Error fetching carriers:", oError);
                    MessageBox.error("Error fetching carrier data");
                }.bind(this)
            });
        },



        /**
         * Navigate to Carrier Inspection Report view with selected date range
         * Handler for Tile 3 press event
         */
        onNavigateToCarrierReport: function () {
            console.log("=== onNavigateToCarrierReport START ===");

            var oViewModel = this.getView().getModel("viewModel");
            var oStartDate = oViewModel.getProperty("/selectedStartDate");
            var oEndDate = oViewModel.getProperty("/selectedEndDate");
            var iAcceptedCount = oViewModel.getProperty("/acceptedCount");
            var iRejectedCount = oViewModel.getProperty("/rejectedCount");

            console.log("Main - Selected Start Date (Date object):", oStartDate);
            console.log("Main - Selected End Date (Date object):", oEndDate);
            console.log("Main - Accepted Count:", iAcceptedCount);
            console.log("Main - Rejected Count:", iRejectedCount);

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);

            // Pass date range and counts as query parameters
            if (oStartDate && oEndDate) {
                var sStartDate = this._formatDateForOData(oStartDate);
                var sEndDate = this._formatDateForOData(oEndDate);

                console.log("Main - Formatted Start Date:", sStartDate);
                console.log("Main - Formatted End Date:", sEndDate);
                console.log("Main - Navigating with query params:", {
                    startDate: sStartDate,
                    endDate: sEndDate,
                    acceptedCount: iAcceptedCount,
                    rejectedCount: iRejectedCount
                });

                oRouter.navTo("RouteCarrierReport", {
                    query: {
                        startDate: sStartDate,
                        endDate: sEndDate,
                        acceptedCount: iAcceptedCount || 0,
                        rejectedCount: iRejectedCount || 0
                    }
                });
            } else {
                console.log("Main - No date range selected, navigating without params");
                // Navigate without date range if not selected
                oRouter.navTo("RouteCarrierReport");
            }

            console.log("=== onNavigateToCarrierReport END ===");
        },

        /**
         * Navigate to AI Summary view with selected date range
         * Handler for Tile 4 press event
         */
        onNavigateToAiSummary: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var oStartDate = oViewModel.getProperty("/selectedStartDate");
            var oEndDate = oViewModel.getProperty("/selectedEndDate");

            if (oStartDate && oEndDate) {
                var sStartDate = this._formatDateForOData(oStartDate);
                var sEndDate = this._formatDateForOData(oEndDate);

                console.log("Main: Navigating to AiSummary with dates:", sStartDate, sEndDate);

                // Store dates in shared data model so AiSummary can access them
                var oSharedModel = this.getOwnerComponent().getModel("sharedData");
                oSharedModel.setProperty("/aiSummaryStartDate", sStartDate);
                oSharedModel.setProperty("/aiSummaryEndDate", sEndDate);

                this.getOwnerComponent().getRouter().navTo("RouteAiSummary");
            } else {
                // Navigate with default date range (today)
                var oToday = new Date();
                var sToday = this._formatDateForOData(oToday);

                console.log("Main: Navigating to AiSummary with default date (today):", sToday);

                var oSharedModel = this.getOwnerComponent().getModel("sharedData");
                oSharedModel.setProperty("/aiSummaryStartDate", sToday);
                oSharedModel.setProperty("/aiSummaryEndDate", sToday);

                this.getOwnerComponent().getRouter().navTo("RouteAiSummary");
            }
        },

        //============= Ai codings ================


        async _loadUserInfo() {

            try {
                if (Container) {
                    const oUserInfo = await Container.getServiceAsync("UserInfo");
                    console.log(oUserInfo);
                    let sName =
                        oUserInfo.getFullName() ||
                        oUserInfo.getFirstName() ||
                        "";

                    if (sName) {
                        sName = this._formatName(sName);
                    }
                    console.log("Resolved Name:", sName);
                    this.getView().getModel("chatModel")
                        .setProperty("/userName", sName);
                }
            } catch (error) {
                console.warn("UserInfo service not available", error);
            }
        },
        _formatName: function (sName) {
            return sName
                .toLowerCase()
                .split(" ")
                .map(function (word) {
                    return word.charAt(0).toUpperCase() + word.slice(1);
                })
                .join(" ");
        },

        onFloatingPress: function (oEvent) {
            const oSource = oEvent.getSource();
            const oDataModel = this.getOwnerComponent().getModel();

            sap.ui.core.BusyIndicator.show(0);

            ODataService.checkLicenseModule(oDataModel, "PrivaModule")
                .then((bAllowed) => {
                    sap.ui.core.BusyIndicator.hide();

                    if (!bAllowed) {
                        MessageBox.error("Your organization has not subscribed to the PRIVA Assist module. Please contact your administrator to upgrade your license.");
                        return;
                    }

                    this._openPrivaAssist(oSource);
                })
                .catch((oError) => {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("License check failed:", oError);
                    MessageBox.error("Unable to verify your license. Please try again.");
                });
        },

        _openPrivaAssist: function (oSource) {
            const oDialog = this.byId("chatDialog");
            const oModel = this.getView().getModel("chatModel");

            if (oModel.getProperty("/messages").length === 0) {
                oModel.setProperty("/messages", [{
                    sender: "AI Assistant",
                    text: "Hello " + oModel.getProperty("/userName") + " 👋\nHow can I help you?",
                }]);
            }

            oDialog.openBy(oSource);
        },

        onCloseChat: function () {
            this.byId("chatDialog").close();
        },

        onPostMessage(oEvent) {

            let sValue = "";

            // If triggered by Input submit
            if (oEvent.getParameter && oEvent.getParameter("value")) {
                sValue = oEvent.getParameter("value");
            }
            // If triggered by button press
            else {
                sValue = this.byId("chatInput").getValue();
            }

            if (!sValue || !sValue.trim()) {
                return;
            }

            this.postMessage(sValue);

            this.byId("chatInput").setValue("");
        },

        postMessage(sValue) {
            const oChatModel = this.getView().getModel("chatModel");
            const aMessages = oChatModel.getProperty("/messages");

            aMessages.push({ sender: "Me", text: sValue });
            aMessages.push({ sender: "AI Assistant", typing: true });
            oChatModel.setProperty("/messages", aMessages);
            this._scrollToBottom();

            const oInspectionModel = this.getOwnerComponent().getModel("inspectionModel");
            oInspectionModel.create("/analyze", { question: sValue }, {
                success: (oData) => {
                    this._removeTyping();
                    const oResult = oData.analyze.message
                    const sMessage = oResult;
                    this._addBotMessage(sMessage, oData.analyze.tokenUsage);
                    this._scrollToBottom();
                },
                error: () => {
                    this._removeTyping();
                    this._addBotMessage("Agent error. Please try again.");
                    this._scrollToBottom();
                }
            });
        },

        _removeTyping() {
            const oChatModel = this.getView().getModel("chatModel");
            const aMessages = oChatModel.getProperty("/messages")
                .filter(m => !m.typing);

            oChatModel.setProperty("/messages", aMessages);
        },
        _addBotMessage(sText, oTokenUsage) {

            const oChatModel = this.getView().getModel("chatModel");
            const aMessages = oChatModel.getProperty("/messages");

            aMessages.push({
                sender: "AI Assistant",
                text: sText,
                tokenUsage: this.formatTokenUsage(oTokenUsage)
            });

            oChatModel.setProperty("/messages", aMessages);
            this._scrollToBottom();
        },

        _scrollToBottom() {
            const oScroll = this.byId("chatScroll");
            setTimeout(() => {
                oScroll.scrollTo(0, oScroll.getScrollDelegate().getMaxScrollTop());
            }, 100);
        },

        onChatAfterOpen: function () {
            this._scrollToBottom();
        },
        formatTokenUsage: function (oTokenUsage) {
            if (!oTokenUsage) {
                return "";
            }

            if (typeof oTokenUsage === "number") {
                return "Usage: " + oTokenUsage;
            }

            const iTotal = oTokenUsage.totalTokens ?? oTokenUsage.total_tokens
                ?? ((oTokenUsage.promptTokens ?? oTokenUsage.prompt_tokens ?? 0)
                    + (oTokenUsage.completionTokens ?? oTokenUsage.completion_tokens ?? 0));

            return iTotal ? "Usage: " + iTotal : "";
        },
        formatInitial: function (sName) {
            if (!sName) {
                return "U";
            }

            return sName.trim().charAt(0).toUpperCase();
        }

    });
});