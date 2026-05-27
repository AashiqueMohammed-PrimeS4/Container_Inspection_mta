sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
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
                selectedEndDate: null,
                // Trend Analysis tab
                trendChartType: "column",
                trendShowChart: false,
                trendIsLoading: false,
                trendShowNoData: false,
                trendChartData: [],
                trendTotalAccepted: 0,
                trendTotalRejected: 0,
                trendAvgAccepted: 0,
                trendAvgRejected: 0
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
                    this._loadTrendData(sStartDate, sEndDate);

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


        // ============= Trend Analysis =============

        _loadTrendData: function (sStartDate, sEndDate) {
            var oStartDate = new Date(sStartDate);
            var oEndDate = new Date(sEndDate);
            var iDaysDiff = Math.ceil((oEndDate - oStartDate) / (1000 * 60 * 60 * 24));

            if (iDaysDiff > 90) {
                MessageToast.show("Date range exceeds 90 days — trend data limited to first 90 days.");
                oEndDate = new Date(oStartDate);
                oEndDate.setDate(oEndDate.getDate() + 90);
            }

            this._fetchTrendData(oStartDate, oEndDate);
        },

        _fetchTrendData: function (oStartDate, oEndDate) {
            var oViewModel = this.getView().getModel("viewModel");

            oViewModel.setProperty("/trendIsLoading", true);
            oViewModel.setProperty("/trendShowChart", false);
            oViewModel.setProperty("/trendShowNoData", false);

            var aDates = this._getTrendDateRange(oStartDate, oEndDate);
            var aPromises = [];
            var oResults = {};
            this._trendCarrierCache = {};

            aDates.forEach(function (oDate) {
                var sDisplayDate = this._formatDateForDisplay(oDate);
                oResults[sDisplayDate] = { date: sDisplayDate, accepted: 0, rejected: 0 };
                this._trendCarrierCache[sDisplayDate] = { accepted: [], rejected: [] };

                aPromises.push(this._fetchCarriersWithCountPromise(oDate, "A").then(function (oData) {
                    oResults[sDisplayDate].accepted = oData.count;
                    this._trendCarrierCache[sDisplayDate].accepted = oData.carriers;
                }.bind(this)));
                aPromises.push(this._fetchCarriersWithCountPromise(oDate, "R").then(function (oData) {
                    oResults[sDisplayDate].rejected = oData.count;
                    this._trendCarrierCache[sDisplayDate].rejected = oData.carriers;
                }.bind(this)));
            }.bind(this));

            Promise.all(aPromises).then(function () {
                var aChartData = aDates.map(function (oDate) {
                    return oResults[this._formatDateForDisplay(oDate)];
                }.bind(this));

                var iTotalAccepted = 0, iTotalRejected = 0, bHasData = false;
                aChartData.forEach(function (oData) {
                    iTotalAccepted += oData.accepted;
                    iTotalRejected += oData.rejected;
                    if (oData.accepted > 0 || oData.rejected > 0) { bHasData = true; }
                });

                var iDaysCount = aChartData.length;
                oViewModel.setProperty("/trendChartData", aChartData);
                oViewModel.setProperty("/trendTotalAccepted", iTotalAccepted);
                oViewModel.setProperty("/trendTotalRejected", iTotalRejected);
                oViewModel.setProperty("/trendAvgAccepted", iDaysCount > 0 ? (iTotalAccepted / iDaysCount).toFixed(1) : 0);
                oViewModel.setProperty("/trendAvgRejected", iDaysCount > 0 ? (iTotalRejected / iDaysCount).toFixed(1) : 0);
                oViewModel.setProperty("/trendIsLoading", false);
                oViewModel.setProperty("/trendShowChart", bHasData);
                oViewModel.setProperty("/trendShowNoData", !bHasData);
            }.bind(this)).catch(function (oError) {
                console.error("Error fetching trend data:", oError);
                oViewModel.setProperty("/trendIsLoading", false);
                oViewModel.setProperty("/trendShowNoData", true);
            }.bind(this));
        },

        _getTrendDateRange: function (oStartDate, oEndDate) {
            var aDates = [];
            var oCurrentDate = new Date(oStartDate);
            while (oCurrentDate <= oEndDate) {
                aDates.push(new Date(oCurrentDate));
                oCurrentDate.setDate(oCurrentDate.getDate() + 1);
            }
            return aDates;
        },

        _formatDateForDisplay: function (oDate) {
            var sDay = ("0" + oDate.getDate()).slice(-2);
            var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
            return sDay + "/" + sMonth + "/" + oDate.getFullYear();
        },

        _fetchCarriersWithCountPromise: function (oDate, sStatus) {
            return new Promise(function (resolve) {
                var oModel = this.getView().getModel();
                var sFormattedDate = this._formatDateForOData(new Date(oDate));
                var aFilters = [
                    new Filter("InspectionDate", FilterOperator.EQ, sFormattedDate),
                    new Filter("Status", FilterOperator.EQ, sStatus)
                ];
                oModel.read("/InspectionHeaderSet", {
                    filters: aFilters,
                    success: function (oData) {
                        var aCarriers = [], iCount = 0;
                        if (oData.results && oData.results.length > 0) {
                            iCount = oData.results.length;
                            aCarriers = oData.results.map(function (oItem) {
                                return oItem.CarrierNumber || oItem.Carrier || "N/A";
                            });
                        }
                        resolve({ count: iCount, carriers: aCarriers });
                    },
                    error: function () { resolve({ count: 0, carriers: [] }); }
                });
            }.bind(this));
        },

        onTrendChartTypeChange: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            this.getView().getModel("viewModel").setProperty("/trendChartType", sKey);
            MessageToast.show("Chart type changed to " + (sKey === "line" ? "Line Chart" : "Bar Chart"));
        },

        onTrendChartBarSelect: function (oEvent) {
            var aData = oEvent.getParameter("data");
            if (!aData || aData.length === 0) { return; }

            var oSelectedData = aData[0].data;
            var sSelectedDate = oSelectedData.Date;
            var aParts = sSelectedDate.split("/");
            if (aParts.length !== 3) { return; }
            var oDate = new Date(parseInt(aParts[2]), parseInt(aParts[1]) - 1, parseInt(aParts[0]));

            var sStatus = "A", sStatusLabel = "Accepted";
            if (oSelectedData.measureNames === "Rejected") { sStatus = "R"; sStatusLabel = "Rejected"; }

            if (this._trendCarrierCache && this._trendCarrierCache[sSelectedDate]) {
                var aCarriers = sStatus === "A"
                    ? this._trendCarrierCache[sSelectedDate].accepted
                    : this._trendCarrierCache[sSelectedDate].rejected;
                if (aCarriers && aCarriers.length > 0) {
                    this._showTrendCarrierPopover(aCarriers, sStatusLabel, sSelectedDate, oEvent);
                    return;
                }
            }

            var oModel = this.getView().getModel();
            var sFormattedDate = this._formatDateForOData(new Date(oDate));
            oModel.read("/InspectionHeaderSet", {
                filters: [
                    new Filter("InspectionDate", FilterOperator.EQ, sFormattedDate),
                    new Filter("Status", FilterOperator.EQ, sStatus)
                ],
                success: function (oData) {
                    if (oData.results && oData.results.length > 0) {
                        var aCarrierNumbers = oData.results.map(function (oItem) {
                            return oItem.CarrierNumber || oItem.Carrier || "N/A";
                        });
                        this._showTrendCarrierPopover(aCarrierNumbers, sStatusLabel, sSelectedDate, oEvent);
                    } else {
                        MessageToast.show("No carriers found for this selection");
                    }
                }.bind(this),
                error: function () { MessageBox.error("Error fetching carrier details."); }.bind(this)
            });
        },

        _showTrendCarrierPopover: function (aCarrierNumbers, sStatusLabel, sDate, oEvent) {
            if (this._oTrendCarrierPopover) { this._oTrendCarrierPopover.destroy(); }

            var oTarget = oEvent && oEvent.mParameters && oEvent.mParameters.data && oEvent.mParameters.data[0]
                ? oEvent.mParameters.data[0].target : null;

            var aUnique = Array.from(new Set(aCarrierNumbers));
            var iTotalCount = aCarrierNumbers.length;
            var sInfoText = iTotalCount === aUnique.length
                ? "Total: " + iTotalCount + " carrier(s)"
                : "Total: " + iTotalCount + " carrier(s) (" + aUnique.length + " unique)";

            this._oTrendCarrierPopover = new sap.m.Popover({
                title: sStatusLabel + " Carriers - " + sDate,
                placement: sap.m.PlacementType.Top,
                contentWidth: "300px",
                content: [
                    new sap.m.VBox({
                        width: "100%",
                        items: [
                            new sap.m.Text({ text: sInfoText }).addStyleClass("sapUiTinyMarginBegin sapUiTinyMarginTop"),
                            new sap.m.ScrollContainer({
                                height: aUnique.length <= 3 ? "90px" : "150px",
                                width: "100%",
                                vertical: true,
                                content: [new sap.m.List({
                                    items: aUnique.map(function (s) {
                                        return new sap.m.StandardListItem({ title: s, icon: "sap-icon://shipping-status" });
                                    }),
                                    showNoData: false
                                })]
                            })
                        ]
                    })
                ],
                footer: new sap.m.Toolbar({
                    content: [
                        new sap.m.ToolbarSpacer(),
                        new sap.m.Button({ text: "Close", press: function () { this._oTrendCarrierPopover.close(); }.bind(this) })
                    ]
                })
            });

            var oVizFrame = this.byId("aiTrendChart");
            if (oTarget && oTarget.nodeType === 1) {
                this._oTrendCarrierPopover.openBy(oTarget);
            } else {
                this._oTrendCarrierPopover.openBy(oVizFrame);
            }
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