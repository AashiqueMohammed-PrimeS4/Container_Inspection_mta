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

                // Date range analysis properties
                rangeSelected: false,
                showChart: false,
                isLoading: false,
                showNoData: false,
                chartType: "line",
                chartData: [],

                // Summary statistics
                totalAccepted: 0,
                totalRejected: 0,
                avgAccepted: 0,
                avgRejected: 0
            });
            this.getView().setModel(oViewModel, "viewModel");
            // const oChatModel = new JSONModel({
            //     messages: [],
            //     userName: "User",
            //     suggestions: [
            //         { title: "Get Total Inspections" },
            //         { title: "Get accepted & rejected Count" },
            //         { title: "Top rejection reasons" },
            //         { title: "Top rejection carrier lines" },
            //         { title: "Previous rejection rate" }
            //     ]
            // });
            // this._loadUserInfo();
            // this.getView().setModel(oChatModel, "chatModel");


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

        // ========== Date Range Analysis Functionality ========== //

        /**
         * Handler for date range selection change event
         * Stores the selected date range for trend analysis
         * @param {sap.ui.base.Event} oEvent - The date range change event
         */
        onDateRangeChange: function (oEvent) {
            var oDateRangeSelection = oEvent.getSource();
            var oStartDate = oDateRangeSelection.getDateValue();
            var oEndDate = oDateRangeSelection.getSecondDateValue();

            var oViewModel = this.getView().getModel("viewModel");

            if (oStartDate && oEndDate) {
                oViewModel.setProperty("/rangeSelected", true);
                this._selectedDateRange = {
                    startDate: oStartDate,
                    endDate: oEndDate
                };
            } else {
                oViewModel.setProperty("/rangeSelected", false);
                this._selectedDateRange = null;
            }
        },

        /**
         * Handler for Analyze Trends button press
         * Validates date range (max 90 days) and triggers trend data fetching
         */
        onAnalyzeTrends: function () {
            if (!this._selectedDateRange) {
                MessageToast.show("Please select a date range first");
                return;
            }

            var oStartDate = this._selectedDateRange.startDate;
            var oEndDate = this._selectedDateRange.endDate;
            var iDaysDiff = this._getDaysBetween(oStartDate, oEndDate);

            // Validate range constraints
            if (iDaysDiff > 90) {
                MessageBox.warning("Please select a date range of maximum 90 days for better performance.");
                return;
            }

            if (iDaysDiff < 0) {
                MessageBox.error("Invalid date range. End date must be after start date.");
                return;
            }

            this._fetchTrendData(oStartDate, oEndDate);
        },

        /**
         * Calculate days between two dates
         * @param {Date} oStartDate - Start date
         * @param {Date} oEndDate - End date
         * @returns {number} Number of days between dates
         */
        _getDaysBetween: function (oStartDate, oEndDate) {
            var iMilliseconds = oEndDate.getTime() - oStartDate.getTime();
            return Math.ceil(iMilliseconds / (1000 * 60 * 60 * 24));
        },

        /**
         * Generate array of dates between start and end date (inclusive)
         * @param {Date} oStartDate - Start date
         * @param {Date} oEndDate - End date
         * @returns {Date[]} Array of Date objects for each day in range
         */
        _getDateRange: function (oStartDate, oEndDate) {
            var aDates = [];
            var oCurrentDate = new Date(oStartDate);

            while (oCurrentDate <= oEndDate) {
                aDates.push(new Date(oCurrentDate));
                oCurrentDate.setDate(oCurrentDate.getDate() + 1);
            }

            return aDates;
        },

        /**
         * Format date for display (dd/MM/yyyy)
         * @param {Date} oDate - Date to format
         * @returns {string} Formatted date string (dd/MM/yyyy)
         */
        _formatDateForDisplay: function (oDate) {
            var sDay = ("0" + oDate.getDate()).slice(-2);
            var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
            var sYear = oDate.getFullYear();
            return sDay + "/" + sMonth + "/" + sYear;
        },

        /**
         * Fetch trend data for the selected date range
         * Makes parallel OData calls for each date and aggregates results
         * @param {Date} oStartDate - Start date of range
         * @param {Date} oEndDate - End date of range
         */
        _fetchTrendData: function (oStartDate, oEndDate) {
            var oViewModel = this.getView().getModel("viewModel");

            oViewModel.setProperty("/isLoading", true);
            oViewModel.setProperty("/showChart", false);
            oViewModel.setProperty("/showNoData", false);

            var aDates = this._getDateRange(oStartDate, oEndDate);
            var aPromises = [];
            var oResults = {};

            this._carrierCache = {};

            // Parallel fetch for all dates in range
            aDates.forEach(function (oDate) {
                var sFormattedDate = this._formatDateForOData(oDate);
                var sDisplayDate = this._formatDateForDisplay(oDate);

                oResults[sDisplayDate] = {
                    date: sDisplayDate,
                    accepted: 0,
                    rejected: 0
                };

                this._carrierCache[sDisplayDate] = {
                    accepted: [],
                    rejected: []
                };

                var oAcceptedPromise = this._fetchCarriersWithCountPromise(oDate, "A");
                var oRejectedPromise = this._fetchCarriersWithCountPromise(oDate, "R");

                aPromises.push(
                    oAcceptedPromise.then(function (oData) {
                        oResults[sDisplayDate].accepted = oData.count;
                        this._carrierCache[sDisplayDate].accepted = oData.carriers;
                    }.bind(this)),
                    oRejectedPromise.then(function (oData) {
                        oResults[sDisplayDate].rejected = oData.count;
                        this._carrierCache[sDisplayDate].rejected = oData.carriers;
                    }.bind(this))
                );
            }.bind(this));

            // Wait for all promises to complete
            Promise.all(aPromises)
                .then(function () {
                    // Convert results object to array and sort by date
                    var aChartData = aDates.map(function (oDate) {
                        var sDisplayDate = this._formatDateForDisplay(oDate);
                        return oResults[sDisplayDate];
                    }.bind(this));

                    // Calculate summary statistics
                    var iTotalAccepted = 0;
                    var iTotalRejected = 0;
                    var bHasData = false;

                    aChartData.forEach(function (oData) {
                        iTotalAccepted += oData.accepted;
                        iTotalRejected += oData.rejected;
                        if (oData.accepted > 0 || oData.rejected > 0) {
                            bHasData = true;
                        }
                    });

                    var iDaysCount = aChartData.length;
                    var fAvgAccepted = iDaysCount > 0 ? (iTotalAccepted / iDaysCount).toFixed(1) : 0;
                    var fAvgRejected = iDaysCount > 0 ? (iTotalRejected / iDaysCount).toFixed(1) : 0;

                    // Update view model
                    oViewModel.setProperty("/chartData", aChartData);
                    oViewModel.setProperty("/totalAccepted", iTotalAccepted);
                    oViewModel.setProperty("/totalRejected", iTotalRejected);
                    oViewModel.setProperty("/avgAccepted", fAvgAccepted);
                    oViewModel.setProperty("/avgRejected", fAvgRejected);
                    oViewModel.setProperty("/isLoading", false);

                    if (bHasData) {
                        oViewModel.setProperty("/showChart", true);
                        oViewModel.setProperty("/showNoData", false);
                        MessageToast.show("Trend analysis completed successfully");
                    } else {
                        oViewModel.setProperty("/showChart", false);
                        oViewModel.setProperty("/showNoData", true);
                    }
                }.bind(this))
                .catch(function (oError) {
                    console.error("Error fetching trend data:", oError);
                    MessageBox.error("Error fetching trend data. Please try again.");
                    oViewModel.setProperty("/isLoading", false);
                    oViewModel.setProperty("/showChart", false);
                    oViewModel.setProperty("/showNoData", true);
                }.bind(this));
        },


        /**
         * Fetch carriers with count in a single call (used for trend analysis)
         * @param {Date} oDate - The inspection date
         * @param {string} sStatus - Status code ("A" or "R")
         * @returns {Promise<{count: number, carriers: string[]}>} Promise resolving with count and carrier list
         */
        _fetchCarriersWithCountPromise: function (oDate, sStatus) {
            return new Promise(function (resolve, reject) {
                var oModel = this.getView().getModel();
                var sPath = "/InspectionHeaderSet";
                var sFormattedDate = this._formatDateForOData(oDate);

                var aFilters = [
                    new Filter("InspectionDate", FilterOperator.EQ, sFormattedDate),
                    new Filter("Status", FilterOperator.EQ, sStatus)
                ];

                oModel.read(sPath, {
                    filters: aFilters,
                    success: function (oData) {
                        var aCarriers = [];
                        var iCount = 0;

                        if (oData.results && oData.results.length > 0) {
                            iCount = oData.results.length;
                            aCarriers = oData.results.map(function (oItem) {
                                return oItem.CarrierNumber || oItem.Carrier || "N/A";
                            });
                        }

                        resolve({
                            count: iCount,
                            carriers: aCarriers
                        });
                    },
                    error: function (oError) {
                        console.error("Error fetching carriers:", oError);
                        // Resolve with empty data instead of rejecting
                        resolve({
                            count: 0,
                            carriers: []
                        });
                    }
                });
            }.bind(this));
        },

        /**
         * Handler for chart type toggle button (Line vs Bar)
         * @param {sap.ui.base.Event} oEvent - The selection change event
         */
        onChartTypeChange: function (oEvent) {
            var sSelectedKey = oEvent.getParameter("item").getKey();
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/chartType", sSelectedKey);

            MessageToast.show("Chart type changed to " + (sSelectedKey === "line" ? "Line Chart" : "Bar Chart"));
        },

        /**
         * Handler for chart bar/point selection
         * Shows carrier numbers in a popover when a data point is clicked
         * Uses cached data when available for instant display
         * @param {sap.ui.base.Event} oEvent - The chart selection event
         */
        onChartBarSelect: function (oEvent) {
            var aData = oEvent.getParameter("data");

            if (!aData || aData.length === 0) {
                return;
            }

            // Get the selected data point
            var oSelectedData = aData[0].data;
            var sSelectedDate = oSelectedData.Date;

            // Parse the display date back to a Date object
            var oDate = this._parseDisplayDate(sSelectedDate);

            if (!oDate) {
                MessageToast.show("Unable to parse selected date");
                return;
            }

            // Determine which status was clicked based on the measure dimension
            var sStatus = "A"; // Default to Accepted
            var sStatusLabel = "Accepted";

            // Check the measureNames property to determine which measure was clicked
            if (oSelectedData.measureNames) {
                if (oSelectedData.measureNames === "Rejected") {
                    sStatus = "R";
                    sStatusLabel = "Rejected";
                } else if (oSelectedData.measureNames === "Accepted") {
                    sStatus = "A";
                    sStatusLabel = "Accepted";
                }
            }

            // Check if we have cached data for instant display
            if (this._carrierCache && this._carrierCache[sSelectedDate]) {
                var aCarriers = sStatus === "A"
                    ? this._carrierCache[sSelectedDate].accepted
                    : this._carrierCache[sSelectedDate].rejected;

                if (aCarriers && aCarriers.length > 0) {
                    // Show popover immediately with cached data
                    this._showCarrierPopover(aCarriers, sStatusLabel, sSelectedDate, oEvent);
                    return;
                }
            }

            // Fallback: Fetch carrier numbers if not in cache
            this._fetchCarrierNumbers(oDate, sStatus, sStatusLabel, oEvent);
        },

        /**
         * Parse display date (dd/MM/yyyy) back to Date object
         * @param {string} sDisplayDate - Date string in dd/MM/yyyy format
         * @returns {Date|null} Date object or null if invalid format
         */
        _parseDisplayDate: function (sDisplayDate) {
            var aParts = sDisplayDate.split("/");
            if (aParts.length !== 3) {
                return null;
            }

            var iDay = parseInt(aParts[0], 10);
            var iMonth = parseInt(aParts[1], 10) - 1; // Months are 0-based
            var iYear = parseInt(aParts[2], 10);

            return new Date(iYear, iMonth, iDay);
        },

        /**
         * Fetch carrier numbers for a specific date and status from OData service
         * @param {Date} oDate - The inspection date
         * @param {string} sStatus - Status code ("A" or "R")
         * @param {string} sStatusLabel - Status label for display ("Accepted"/"Rejected")
         * @param {sap.ui.base.Event} oEvent - The chart event object for popover positioning
         */
        _fetchCarrierNumbers: function (oDate, sStatus, sStatusLabel, oEvent) {
            var oModel = this.getView().getModel();
            var sPath = "/InspectionHeaderSet";
            var sFormattedDate = this._formatDateForOData(oDate);

            // Create filters
            var aFilters = [
                new Filter("InspectionDate", FilterOperator.EQ, sFormattedDate),
                new Filter("Status", FilterOperator.EQ, sStatus)
            ];

            oModel.read(sPath, {
                filters: aFilters,
                success: function (oData) {
                    if (oData.results && oData.results.length > 0) {
                        // Extract carrier numbers
                        var aCarrierNumbers = oData.results.map(function (oItem) {
                            return oItem.CarrierNumber || oItem.Carrier || "N/A";
                        });

                        // Show carriers in a popover positioned at the bar
                        this._showCarrierPopover(aCarrierNumbers, sStatusLabel, this._formatDateForDisplay(oDate), oEvent);
                    } else {
                        MessageToast.show("No carriers found for this selection");
                    }
                }.bind(this),
                error: function (oError) {
                    console.error("Error fetching carrier numbers:", oError);
                    MessageBox.error("Error fetching carrier details. Please try again.");
                }.bind(this)
            });
        },

        /**
         * Show carrier numbers in a popover near the clicked chart element
         * Removes duplicates and displays with count information
         * Fixed height with scrolling for better UX when many carriers
         * @param {string[]} aCarrierNumbers - Array of carrier numbers
         * @param {string} sStatusLabel - Status label ("Accepted"/"Rejected")
         * @param {string} sDate - Formatted date string for display
         * @param {sap.ui.base.Event} oEvent - The chart event for popover positioning
         */
        _showCarrierPopover: function (aCarrierNumbers, sStatusLabel, sDate, oEvent) {
            // Close existing popover if open
            if (this._oCarrierPopover) {
                this._oCarrierPopover.destroy();
            }

            // Get the clicked DOM element (the bar itself)
            var oTarget = null;
            if (oEvent && oEvent.mParameters && oEvent.mParameters.data && oEvent.mParameters.data[0]) {
                oTarget = oEvent.mParameters.data[0].target;
            }

            // Remove duplicate carrier numbers - show unique values only
            var aUniqueCarrierNumbers = Array.from(new Set(aCarrierNumbers));

            // Store original count before deduplication
            var iTotalCount = aCarrierNumbers.length;
            var iUniqueCount = aUniqueCarrierNumbers.length;

            // Dynamic height based on carrier count: 100px for less than 3, 150px otherwise
            var sContentHeight = iUniqueCount <= 3 ? "90px" : "150px";

            // Build info text with unique count if there are duplicates
            var sInfoText = iTotalCount === iUniqueCount
                ? "Total: " + iTotalCount + " carrier(s)"
                : "Total: " + iTotalCount + " carrier(s) (" + iUniqueCount + " unique)";

            // Create the carrier list
            var oCarrierList = new sap.m.List({
                items: aUniqueCarrierNumbers.map(function (sCarrierNumber) {
                    return new sap.m.StandardListItem({
                        title: sCarrierNumber,
                        icon: "sap-icon://shipping-status"
                    });
                }),
                mode: sap.m.ListMode.None,
                showNoData: false
            });

            // Wrap list in ScrollContainer for proper scrolling
            var oScrollContainer = new sap.m.ScrollContainer({
                height: sContentHeight,
                width: "100%",
                horizontal: false,
                vertical: true,
                content: [oCarrierList]
            });

            // Create popover with Top placement to ALWAYS show above the bar
            this._oCarrierPopover = new sap.m.Popover({
                title: sStatusLabel + " Carriers - " + sDate,
                placement: sap.m.PlacementType.Top,
                contentWidth: "300px",
                showArrow: true,
                content: [
                    new sap.m.VBox({
                        width: "100%",
                        items: [
                            new sap.m.Text({
                                text: sInfoText
                            }).addStyleClass("sapUiTinyMarginBegin sapUiTinyMarginTop"),
                            oScrollContainer
                        ]
                    })
                ],
                footer: new sap.m.Toolbar({
                    content: [
                        new sap.m.ToolbarSpacer(),
                        new sap.m.Button({
                            text: "Close",
                            press: function () {
                                this._oCarrierPopover.close();
                            }.bind(this)
                        })
                    ]
                })
            });

            // Open popover anchored to the clicked bar element
            if (oTarget && oTarget.nodeType === 1) {
                // If we have a valid DOM element, use it as anchor
                this._oCarrierPopover.openBy(oTarget);
            } else {
                // Fallback to VizFrame
                var oVizFrame = this.byId("inspectionTrendChart");
                this._oCarrierPopover.openBy(oVizFrame);
            }
        },
        //============= Ai codings ================


        // async _loadUserInfo() {

        //     try {
        //         if (Container) {
        //             const oUserInfo = await Container.getServiceAsync("UserInfo");
        //             console.log(oUserInfo);
        //             let sName =
        //                 oUserInfo.getFullName() ||
        //                 oUserInfo.getFirstName() ||
        //                 "";

        //             if (sName) {
        //                 sName = this._formatName(sName);
        //             }
        //             console.log("Resolved Name:", sName);
        //             this.getView().getModel("chatModel")
        //                 .setProperty("/userName", sName);
        //         }
        //     } catch (error) {
        //         console.warn("UserInfo service not available", error);
        //     }
        // },
        // _formatName: function (sName) {
        //     return sName
        //         .toLowerCase()
        //         .split(" ")
        //         .map(function (word) {
        //             return word.charAt(0).toUpperCase() + word.slice(1);
        //         })
        //         .join(" ");
        // },

        // onFloatingPress: function (oEvent) {
        //     const oDialog = this.byId("chatDialog");
        //     const oModel = this.getView().getModel("chatModel");

        //     if (oModel.getProperty("/messages").length === 0) {
        //         const sName = oModel.getProperty("/userName");
        //         oModel.setProperty("/messages", [{
        //             sender: "AI Assistant",
        //             text: "Hello " + (sName ? sName : "there") + " 👋\nHow can I help you?"
        //         }]);
        //     }

        //     oDialog.openBy(oEvent.getSource());
        // },

        // onCloseChat: function () {
        //     this.byId("chatDialog").close();
        // },

        // onSuggestionItemPress: function (oEvent) {
        //     const sText = oEvent.getSource().getTitle();
        //     console.log("hi")
        //     this.byId("chatInput").setValue(sText);

        //     this.byId("suggestionPopover").close();
        // },

        // onOpenSuggestionPopover: function (oEvent) {


        //     const oPopover = this.byId("suggestionPopover");
        //     oPopover.openBy(oEvent.getSource());
        // },


        // onPostMessage(oEvent) {

        //     let sValue = "";

        //     // If triggered by Input submit
        //     if (oEvent.getParameter && oEvent.getParameter("value")) {
        //         sValue = oEvent.getParameter("value");
        //     }
        //     // If triggered by button press
        //     else {
        //         sValue = this.byId("chatInput").getValue();
        //     }

        //     if (!sValue || !sValue.trim()) {
        //         return;
        //     }

        //     this.postMessage(sValue);

        //     this.byId("chatInput").setValue("");
        // },

        // async postMessage(sValue) {
        //     const oChatModel = this.getView().getModel("chatModel");
        //     const aMessages = oChatModel.getProperty("/messages");

        //     // Add user message
        //     aMessages.push({ sender: "Me", text: sValue });
        //     // Add typing indicator
        //     aMessages.push({ sender: "AI Assistant", typing: true });
        //     oChatModel.setProperty("/messages", aMessages);
        //     this._scrollToBottom();

        //     try {
        //         const oResult = await this._callLLM(sValue);
        //         this._removeTyping();
        //         this._addBotMessage(oResult.message || "No response received.");
        //     } catch (e) {
        //         console.error("LLM call failed", e);
        //         this._removeTyping();
        //         this._addBotMessage("Backend error. Please try again.");
        //     }

        //     this._scrollToBottom();
        // },

        // async _callLLM(sQuestion) {
        //     const response = await fetch("/odata/v4/llm2/generateQuery", {
        //         method: "POST",
        //         headers: {
        //             "Content-Type": "application/json",
        //             "Accept": "application/json"
        //         },
        //         body: JSON.stringify({ question: sQuestion })
        //     });

        //     if (!response.ok) {
        //         throw new Error("HTTP " + response.status);
        //     }

        //     const oJson = await response.json();
        //     return oJson.value !== undefined ? oJson.value : oJson;
        // },

        // _removeTyping() {
        //     const oChatModel = this.getView().getModel("chatModel");
        //     const aMessages = oChatModel.getProperty("/messages")
        //         .filter(m => !m.typing);

        //     oChatModel.setProperty("/messages", aMessages);
        // },
        // _addBotMessage(sText) {

        //     const oChatModel = this.getView().getModel("chatModel");
        //     const aMessages = oChatModel.getProperty("/messages");

        //     aMessages.push({
        //         sender: "AI Assistant",
        //         text: sText
        //     });

        //     oChatModel.setProperty("/messages", aMessages);
        //     this._scrollToBottom();
        // },

        // _scrollToBottom() {
        //     const oScroll = this.byId("chatScroll");
        //     setTimeout(() => {
        //         oScroll.scrollTo(0, oScroll.getScrollDelegate().getMaxScrollTop());
        //     }, 100);
        // },

        // onChatAfterOpen: function () {
        //     this._scrollToBottom();
        // },
        // formatInitial: function (sName) {
        //     if (!sName) {
        //         return "U";
        //     }

        //     return sName.trim().charAt(0).toUpperCase();
        // }

    });
});