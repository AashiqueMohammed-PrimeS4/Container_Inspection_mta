sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (
    Controller,
    JSONModel,
    MessageBox,
    MessageToast
) {
    "use strict";

    return Controller.extend("carrieranalytics.controller.AiSummary", {
        /**
         * @override
         * @returns {void|undefined}
         */
        onInit: function () {
            // Initialize view model
            var oViewModel = new JSONModel({
                summaryData: null,
                insights: [],
                isLoading: false,
                selectedStartDate: null,
                selectedEndDate: null
            });
            this.getView().setModel(oViewModel, "viewModel");



            // Attach to route matched to handle navigation parameters
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.attachRouteMatched(this._onRouteMatched, this);
        },

        /**
         * Handler for route matched event - loads summary data based on date range
         * @param {sap.ui.base.Event} oEvent - Route matched event
         */
        _onRouteMatched: function (oEvent) {
            var sRouteName = oEvent.getParameter("name");
            if (sRouteName === "RouteAiSummary") {
                // Get dates from shared data model
                var oComponent = this.getOwnerComponent();
                var oSharedModel = oComponent.getModel("sharedData");
                var sStartDate = oSharedModel.getProperty("/aiSummaryStartDate");
                var sEndDate = oSharedModel.getProperty("/aiSummaryEndDate");

                // console.log("DEBUG: Retrieved dates from sharedData model - Start:", sStartDate, "End:", sEndDate);

                if (sStartDate && sEndDate) {
                    this._loadSummaryData(sStartDate, sEndDate);
                    this._loadInsights(sStartDate, sEndDate);

                } else {
                    // Use today as default
                    var oToday = new Date();
                    var sToday = this._formatDateForOData(oToday);
                    console.log("DEBUG: Using default date (today):", sToday);
                    this._loadSummaryData(sToday, sToday);
                }
            }
        },

        /**
         * Format date as YYYY-MM-DD string
         * @param {Date} oDate - The date to format
         * @returns {string} Formatted date string (YYYY-MM-DD)
         */
        _formatDateForOData: function (oDate) {
            var sYear = oDate.getFullYear();
            var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
            var sDay = ("0" + oDate.getDate()).slice(-2);
            return sYear + "-" + sMonth + "-" + sDay;
        },

        /**
         * Fetch inspection summary data from OData service
         * @param {string} sStartDate - Start date (YYYY-MM-DD format)
         * @param {string} sEndDate - End date (YYYY-MM-DD format)
         */
        _loadSummaryData: function (sStartDate, sEndDate) {
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/isLoading", true);

            var oModel = this.getView().getModel();
            var sPath = "/InspectionSummarySet";

            var sFilterQuery = "StartDate eq datetime'" + sStartDate + "T00:00:00' and EndDate eq datetime'" + sEndDate + "T00:00:00'";
            console.log("DEBUG: OData Filter Query:", sFilterQuery);
            console.log("DEBUG: Start Date:", sStartDate, "End Date:", sEndDate);

            oModel.read(sPath, {
                urlParameters: {
                    "$filter": sFilterQuery
                },
                success: function (oData) {
                    oViewModel.setProperty("/isLoading", false);

                    console.log("DEBUG: OData Response:", oData);
                    if (oData.results && oData.results.length > 0) {
                        var oSummary = oData.results[0];
                        console.log("DEBUG: Raw Summary Data:", oSummary);
                        var oFormattedData = this._formatSummaryData(oSummary);
                        console.log("DEBUG: Formatted Summary Data:", oFormattedData);
                        oViewModel.setProperty("/summaryData", oFormattedData);
                        oViewModel.setProperty("/selectedStartDate", sStartDate);
                        oViewModel.setProperty("/selectedEndDate", sEndDate);
                    } else {
                        oViewModel.setProperty("/summaryData", null);
                        MessageToast.show("No summary data available for the selected date range");
                    }
                }.bind(this),
                error: function (oError) {
                    oViewModel.setProperty("/isLoading", false);
                    console.error("Error fetching summary data:", oError);
                    MessageBox.error("Error fetching AI summary data. Please try again.");
                }.bind(this)
            });
        },


        /**
         * Format and structure the summary data for display
         * @param {object} oSummary - Raw summary data from OData
         * @returns {object} Formatted summary object with display text
         */
        _formatSummaryData: function (oSummary) {
            var iTotalInspections = oSummary.TotalInspections || 0;
            var hasData = iTotalInspections > 0;
            var iAcceptedCount = oSummary.AcceptedCount || 0;
            var iRejectedCount = oSummary.RejectedCount || 0;
            var iRejectionRate = oSummary.RejectionRate || 0;
            var iPrevRejectionRate = oSummary.PrevRejectionRate || 0;
            var iRejectionRateDelta = oSummary.RejectionRateDelta || 0;
            var sTopRejectedReason = oSummary.TopRejectedReason || "N/A";
            var sTopRejectedCarrierLine = oSummary.TopRejectedCarrierLine || "N/A";

            // Determine if rejection rate increased or decreased
            var sRateTrend = iRejectionRateDelta < 0 ? "decreased" : (iRejectionRateDelta > 0 ? "increased" : "remained the same");
            var sRateDeltaValue = Math.abs(iRejectionRateDelta);

            return {
                hasData: hasData,
                totalInspections: iTotalInspections,
                acceptedCount: iAcceptedCount,
                rejectedCount: iRejectedCount,
                rejectionRate: iRejectionRate,
                prevRejectionRate: iPrevRejectionRate,
                rejectionRateDelta: iRejectionRateDelta,
                rateTrend: sRateTrend,
                rateDeltaValue: sRateDeltaValue,
                topRejectedReason: sTopRejectedReason,
                topRejectedCarrierLine: sTopRejectedCarrierLine,

                // Summary text lines for display
                summaryLines: [
                    "For the selected period, " + iTotalInspections + " inspections were completed.",
                    iAcceptedCount + " were accepted and " + iRejectedCount + " rejected (" + iRejectionRate + "% rejection rate).",
                    "Top rejection reasons: " + sTopRejectedReason + ".",
                    "Top rejection carrier lines: " + sTopRejectedCarrierLine + ".",
                    "Rejection rate " + sRateTrend + " from " + iPrevRejectionRate + "% to " + iRejectionRate + "% vs previous period."
                ]
            };
        },

        _loadInsights: function (sStartDate, sEndDate) {
            var oViewModel = this.getView().getModel("viewModel");
            var oModel = this.getView().getModel();

            oViewModel.setProperty("/isLoading", true);

            oModel.read("/InspectionInsight2Set", {
                urlParameters: {
                    "$filter":
                        "StartDate ge datetime'" + sStartDate + "T00:00:00' and " +
                        "EndDate le datetime'" + sEndDate + "T23:59:59'"
                },
                success: function (oData) {
                    oViewModel.setProperty("/isLoading", false);
                    var aResults = oData.results || [];

                    // find current carrier items
                    var aCarrierCurrent = aResults.filter(function (oItem) {
                        return oItem.InsightType === "CARRIER_LINE" &&
                            oItem.PeriodType === "CURRENT";
                    });

                    if (aCarrierCurrent.length > 1) {

                        // get first index of current carrier
                        var iInsertIndex = aResults.findIndex(function (oItem) {
                            return oItem.InsightType === "CARRIER_LINE" &&
                                oItem.PeriodType === "CURRENT";
                        });

                        // merge names
                        var sMergedNames = aCarrierCurrent.map(function (oItem) {
                            return oItem.KeyText;
                        }).join(", ");

                        var oMerged = Object.assign({}, aCarrierCurrent[0]);
                        oMerged.KeyText = sMergedNames;

                        // remove original current carriers
                        aResults = aResults.filter(function (oItem) {
                            return !(oItem.InsightType === "CARRIER_LINE" &&
                                oItem.PeriodType === "CURRENT");
                        });

                        // insert merged at original position
                        aResults.splice(iInsertIndex, 0, oMerged);
                    }

                    oViewModel.setProperty("/insights", aResults);

                    console.log("Insights", oData.results);
                },
                error: function () {
                    oViewModel.setProperty("/isLoading", false);
                    MessageBox.error("Failed to load insights");
                }
            });
        },


        formatPanelHeader: function (sType, sKeyText, sKeyId, sPeriodType) {
            if (!sKeyText || !sKeyText.trim()) {
                return "No Data Available";
            }

            switch (sType) {
                case "REASON":
                    return "Rejection Reason: " + sKeyText;

                case "CARRIER_LINE":
                    if (sPeriodType === "CURRENT") {
                        return "Current Carrier Line: " + sKeyText;
                    }
                    if (sPeriodType === "TREND" || sPeriodType === "PREVIOUS") {
                        return "Previous Carrier Line: " + sKeyText;
                    }
                    return "Carrier Line: " + sKeyText;

                case "VEHICLE":
                    return "Vehicle: " + sKeyText + " (" + sKeyId + ")";

                default:
                    return sKeyText;
            }
        }
        ,

        formatInsightHeadline: function (sType, sKeyText, sKeyId, sPeriodType) {
            if (sType === "REASON") {
                return sKeyText + " is the top rejection reason this period.";
            }

            if (sType === "CARRIER_LINE" && sPeriodType === "CURRENT") {
                return sKeyText + " is the top rejection carrier this period.";
            }

            if (sType === "CARRIER_LINE" && sPeriodType === "TREND") {
                return sKeyText + " is the top rejection carrier compared to previous period.";
            }

            if (sType === "VEHICLE") {
                return sKeyText + " (" + sKeyId + ") was rejected multiple times this period.";
            }

            return sKeyText;
        },

        formatInsightEvidence: function (sType, iRej, iTotal, iRate, sPeriodType) {
            if (sPeriodType === "TREND") {
                var sSign = iRate > 0 ? "+" : "";
                return sSign + iRate + "% compared to previous period.";
            }

            if (sType === "VEHICLE") {
                return iRej + " rejection" + (iRej !== 1 ? "s" : "") + " this period.";
            }

            return iRej + " out of " + iTotal + " rejections (" + iRate + "%) in this period.";
        },

        formatSeverityState: function (sSeverity) {
            switch (sSeverity) {
                case "HIGH": return "Error";
                case "MEDIUM": return "Warning";
                case "LOW": return "Success";
                default: return "None";
            }
        },


        isInsightAvailable: function (sKeyText) {
            return !!(sKeyText && sKeyText.trim());
        },


        /**
         * Navigate back to main view
         */
        onNavBack: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteMain");
        }
    });

});