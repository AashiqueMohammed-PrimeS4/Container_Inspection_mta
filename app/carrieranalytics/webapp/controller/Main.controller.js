sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ushell/Container"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, Container) {
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
                userName: "User",
                suggestions: [
                    { title: "Get Total Inspections" },
                    { title: "Get accepted & rejected Count" },
                    { title: "Top rejection reasons" },
                    { title: "Top rejection carrier lines" },
                    { title: "Previous rejection rate" }
                ]
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
            const oDialog = this.byId("chatDialog");
            const oModel = this.getView().getModel("chatModel");

            if (oModel.getProperty("/messages").length === 0) {
                oModel.setProperty("/messages", [{
                    sender: "AI Assistant",
                    text: "Hello " + oModel.getProperty("/userName") + " 👋\nHow can I help you?",
                }]);
            }

            oDialog.openBy(oEvent.getSource());
        },

        onCloseChat: function () {
            this.byId("chatDialog").close();
        },

        onSuggestionItemPress: function (oEvent) {
            const sText = oEvent.getSource().getText();
            this.byId("chatInput").setValue(sText);
        },

        onOpenSuggestionPopover: function (oEvent) {
            const oPopover = this.byId("suggestionPopover");
            oPopover.openBy(oEvent.getSource());
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

            const oView = this.getView();
            const oChatModel = oView.getModel("chatModel");
            const oViewModel = this.getView().getModel("viewModel");
            const sStartDate = oViewModel.getProperty("/selectedStartDate");
            const sEndDate = oViewModel.getProperty("/selectedEndDate");
            console.log(sStartDate);
            console.log(sEndDate);
            const aMessages = oChatModel.getProperty("/messages");

            //  Add User Message (Right side)
            aMessages.push({
                sender: "Me",
                text: sValue
            });
            // Add temporary typing message
            aMessages.push({
                sender: "AI Assistant",
                typing: true
            });


            oChatModel.setProperty("/messages", aMessages);
            this._scrollToBottom();

            const oDialog = this.byId("chatDialog");
            // oDialog.setBusy(true);

            const oODataModel = this.getOwnerComponent().getModel();

            // // Hardcoded dates
            // const sStartDate = "datetime'2025-11-07T00:00:00'";
            // const sEndDate = "datetime'2025-11-30T00:00:00'";

            const sFormattedStart = this._formatDateTimeForOData(sStartDate);
            const sFormattedEnd = this._formatDateTimeForOData(sEndDate);

            const sFilter =
                "StartDate eq " + sFormattedStart +
                " and EndDate eq " + sFormattedEnd;
            oODataModel.read("/InspectionSummarySet", {
                urlParameters: {
                    "$filter": sFilter
                },
                success: (oData) => {
                    if (!oData.results || !oData.results.length) {
                        this._removeTyping();
                        this._addBotMessage("No data found.");
                        // oDialog.setBusy(false);
                        return;
                    }

                    const oSummary = oData.results[0];
                    console.log(oSummary);
                    let sResponse = this._buildResponse(sValue, oSummary);

                    this._removeTyping();

                    this._addBotMessage(sResponse);

                    // oDialog.setBusy(false);
                    this._scrollToBottom();
                },
                error: () => {
                    this._removeTyping();
                    this._addBotMessage("Backend error. Please try again.");
                    this._scrollToBottom();
                }
            });
        },
        _formatDateTimeForOData: function (oDate) {
            var sYear = oDate.getFullYear();
            var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
            var sDay = ("0" + oDate.getDate()).slice(-2);

            return "datetime'" + sYear + "-" + sMonth + "-" + sDay + "T00:00:00'";
        },

        _buildResponse: function (sValue, oSummary) {

            const sQuery = sValue.toLowerCase();

            const total = oSummary.TotalInspections;
            const accepted = oSummary.AcceptedCount;
            const rejected = oSummary.RejectedCount;
            const rate = oSummary.RejectionRate;
            const prevRate = oSummary.PrevRejectionRate;
            const delta = oSummary.RejectionRateDelta;
            const reasons = oSummary.TopRejectedReason;
            const carriers = oSummary.TopRejectedCarrierLine;

            // Clean comma list to readable format
            const formatList = (sText) => {
                if (!sText) return "";
                const arr = sText.split(",").map(s => s.trim());
                if (arr.length === 1) return arr[0];
                if (arr.length === 2) return arr.join(" and ");
                return arr.slice(0, -1).join(", ") + ", and " + arr[arr.length - 1];
            };

            if (sQuery.includes("total")) {
                return `A total of ${total} container inspections were carried out during the selected period, reflecting the operational throughput for this timeframe.`;
            }

            if (sQuery.includes("accepted") || sQuery.includes("rejected")) {
                const compliance = rate <= 5 ? "a strong compliance rate" : rate <= 15 ? "a moderate compliance rate" : "a high rejection rate that warrants attention";
                return `Out of ${total} inspections conducted, ${accepted} containers were accepted and ${rejected} were flagged as rejected — resulting in a ${rate}% rejection rate, indicating ${compliance}.`;
            }

            if (sQuery.includes("reason")) {
                return `Analysis of rejection data reveals that ${formatList(reasons)} are the dominant failure categories this period. Addressing these recurring defects through targeted pre-inspection checks could significantly improve acceptance rates going forward.`;
            }

            if (sQuery.includes("carrier")) {
                const carrierCount = carriers ? carriers.split(",").length : 0;
                const carrierLabel = carrierCount === 1 ? "carrier line" : "carrier lines";
                return `Inspection data highlights ${formatList(carriers)} as the leading ${carrierLabel} with the highest rejection activity during this period. A closer review of their shipments may help identify recurring non-compliance patterns.`;
            }

            if (sQuery.includes("previous") || sQuery.includes("rate")) {
                const trend = delta > 0 ? "increased" : "decreased";
                const adverb = Math.abs(delta) < 2 ? "slightly" : Math.abs(delta) < 5 ? "moderately" : "significantly";
                const reasonPart = reasons ? `, primarily driven by recurring findings in ${formatList(reasons)}` : "";
                return `Rejection rates ${trend} ${adverb} compared to the previous inspection period, moving from ${prevRate}% to ${rate}%${reasonPart}.`;
            }

            // Default full summary
            return `For the selected period, ${total} inspections were completed.\n` +
                `${accepted} were accepted and ${rejected} rejected (${rate}% rejection rate).\n` +
                `Top rejection reasons: ${formatList(reasons)}.\n` +
                `Top rejection carrier lines: ${formatList(carriers)}.\n` +
                `Rejection rate changed from ${prevRate}% to ${rate}% (Δ ${delta}%).`;
        },

        _removeTyping() {
            const oChatModel = this.getView().getModel("chatModel");
            const aMessages = oChatModel.getProperty("/messages")
                .filter(m => !m.typing);

            oChatModel.setProperty("/messages", aMessages);
        },
        _addBotMessage(sText) {

            const oChatModel = this.getView().getModel("chatModel");
            const aMessages = oChatModel.getProperty("/messages");

            aMessages.push({
                sender: "AI Assistant",
                text: sText
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
        formatInitial: function (sName) {
            if (!sName) {
                return "U";
            }

            return sName.trim().charAt(0).toUpperCase();
        }

    });
});