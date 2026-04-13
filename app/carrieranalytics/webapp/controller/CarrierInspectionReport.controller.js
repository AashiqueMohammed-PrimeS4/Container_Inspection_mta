sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/Device",
    "carrieranalytics/libs/pdfMakeLoader"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, Device, pdfMakeLoader) {
    "use strict";

    return Controller.extend("carrieranalytics.controller.CarrierInspectionReport", {

        /**
         * Controller initialization
         * Sets up view models including device model and fetches initial data for current date
         * Uses responsive width detection instead of device type for better responsive behavior
         */
        onInit: function () {
            console.log("CarrierInspectionReport - onInit called");

            // Set device model for responsive design
            var oDeviceModel = new JSONModel(Device);
            oDeviceModel.setDefaultBindingMode("OneWay");
            this.getView().setModel(oDeviceModel, "device");

            // Initialize view model
            var oViewModel = new JSONModel({
                carrierData: [],
                allCarrierData: [], // Store all carrier data for filter functionality
                codeReference: [],
                allCodeReference: [], // Store all codes for search functionality
                currentDate: this._formatDateForDisplay(new Date()),
                currentDateMobile: this._formatDateForDisplayMobile(new Date()), // Short format for mobile
                startDate: null,
                endDate: null,
                isLoadingTable: false,
                isLoadingCodes: false,
                acceptedCount: 0,  // Count of accepted carriers
                rejectedCount: 0,  // Count of rejected carriers
                totalCount: 0,     // Total count of carriers
                // Device-based visibility flags - using screen width for responsive behavior
                isPhone: Device.system.phone,
                isTablet: Device.system.tablet,
                isDesktop: Device.system.desktop,
                showTableView: true,  // Will be updated based on screen width
                showListView: false   // Will be updated based on screen width
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Set initial visibility based on current screen width
            this._updateResponsiveVisibility();

            // Attach resize handler for responsive behavior
            Device.resize.attachHandler(this._updateResponsiveVisibility, this);

            // Attach route matched handler to receive date range from navigation
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteCarrierReport").attachPatternMatched(this._onRouteMatched, this);

            // Wait for model to be available before fetching data
            var oModel = this.getOwnerComponent().getModel();
            console.log("CarrierInspectionReport - OData Model:", oModel);

            if (oModel) {
                var oMetadataLoaded = oModel.metadataLoaded();
                if (oMetadataLoaded) {
                    console.log("CarrierInspectionReport - Waiting for metadata to load...");
                    oMetadataLoaded.then(function () {
                        console.log("CarrierInspectionReport - Metadata loaded, fetching codes...");
                        // Fetch codes after metadata is loaded
                        this._fetchInspectionCodes();
                    }.bind(this)).catch(function (oError) {
                        console.error("Error loading metadata:", oError);
                        MessageBox.error("Error initializing data service. Please refresh the page.");
                    });
                } else {
                    console.log("CarrierInspectionReport - No metadataLoaded promise, fetching immediately");
                    // Fallback if metadataLoaded is not available
                    this._fetchInspectionCodes();
                }
            } else {
                console.error("CarrierInspectionReport - OData model is NULL!");
                MessageBox.error("OData service not available. Please check your configuration.");
            }
        },

        /**
         * Route matched handler to receive date range from navigation
         * @param {sap.ui.base.Event} oEvent - Route matched event
         */
        _onRouteMatched: function (oEvent) {
            console.log("=== CarrierReport _onRouteMatched START ===");

            var oArgs = oEvent.getParameter("arguments");
            console.log("CarrierReport - Route arguments:", oArgs);

            var oViewModel = this.getView().getModel("viewModel");

            // Check if query parameters contain date range
            if (oArgs["?query"]) {
                console.log("CarrierReport - Query params found:", oArgs["?query"]);

                var sStartDate = oArgs["?query"].startDate;
                var sEndDate = oArgs["?query"].endDate;
                var iAcceptedCount = oArgs["?query"].acceptedCount;
                var iRejectedCount = oArgs["?query"].rejectedCount;

                console.log("CarrierReport - Start Date from query:", sStartDate);
                console.log("CarrierReport - End Date from query:", sEndDate);
                console.log("CarrierReport - Accepted Count from query:", iAcceptedCount);
                console.log("CarrierReport - Rejected Count from query:", iRejectedCount);

                if (sStartDate && sEndDate) {
                    console.log("CarrierReport - Using date range from navigation");

                    oViewModel.setProperty("/startDate", sStartDate);
                    oViewModel.setProperty("/endDate", sEndDate);

                    // Set counts if passed from Main view
                    if (iAcceptedCount !== undefined && iRejectedCount !== undefined) {
                        oViewModel.setProperty("/acceptedCount", parseInt(iAcceptedCount, 10));
                        oViewModel.setProperty("/rejectedCount", parseInt(iRejectedCount, 10));
                        console.log("CarrierReport - Counts set from navigation params");
                    }

                    // Update display date
                    var sDisplayDate = sStartDate === sEndDate
                        ? sStartDate
                        : sStartDate + " - " + sEndDate;
                    oViewModel.setProperty("/currentDate", sDisplayDate);

                    // Update mobile display date with short year format (dd/mm/yy)
                    var sDisplayDateMobile = this._convertToShortYear(sDisplayDate);
                    oViewModel.setProperty("/currentDateMobile", sDisplayDateMobile);

                    console.log("CarrierReport - Display date set to:", sDisplayDate);
                    console.log("CarrierReport - Mobile display date set to:", sDisplayDateMobile);

                    // Fetch carrier data with date range
                    this._fetchCarrierData();
                    return;
                }
            }

            // Default: fetch data for current date
            console.log("CarrierReport - No query params, using current date");
            var oCurrentDate = new Date();
            var sFormattedDate = this._formatDateForOData(oCurrentDate);

            console.log("CarrierReport - Current date formatted:", sFormattedDate);

            oViewModel.setProperty("/startDate", sFormattedDate);
            oViewModel.setProperty("/endDate", sFormattedDate);
            oViewModel.setProperty("/currentDate", this._formatDateForDisplay(oCurrentDate));
            oViewModel.setProperty("/currentDateMobile", this._formatDateForDisplayMobile(oCurrentDate));

            this._fetchCarrierData();
            console.log("=== CarrierReport _onRouteMatched END ===");
        },

        /**
         * Navigate back to main view
         */
        onNavBack: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("RouteMain");
        },

        /**
         * Clean up resources when view is destroyed
         * Detach resize handler to prevent memory leaks
         */
        onExit: function () {
            Device.resize.detachHandler(this._updateResponsiveVisibility, this);
        },

        /**
         * Refresh button handler - reload all data
         */
        onRefresh: function () {
            this._fetchCarrierData();
            this._fetchInspectionCodes();
            MessageToast.show("Refreshing data...");
        },

        /**
         * Send email button handler - generates PDF file and opens Outlook
         */
        onSendEmail: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var aCarrierData = oViewModel.getProperty("/carrierData");
            var sStartDate = oViewModel.getProperty("/startDate");
            var sEndDate = oViewModel.getProperty("/endDate");

            // Check if there's data to send
            if (!aCarrierData || aCarrierData.length === 0) {
                MessageBox.warning("No data available to send via email.");
                return;
            }

            // Generate email subject
            var sSubject = "Carrier Inspection Report - " + sStartDate + " to " + sEndDate;
            var sFileName = "CarrierInspectionReport_" + sStartDate + "_to_" + sEndDate + ".pdf";

            // Generate and download PDF file
            this._generatePDFFile(aCarrierData, sStartDate, sEndDate, sFileName);

            // Generate email body with attachment instruction
            var sBody = this._generateEmailBodyWithAttachment(aCarrierData, sStartDate, sEndDate, sFileName);

            // Create Outlook Web App deep link
            var sOutlookWebURL = "https://outlook.office.com/mail/deeplink/compose?subject=" +
                encodeURIComponent(sSubject) +
                "&body=" + encodeURIComponent(sBody);

            // Open Outlook Web App in popup window after a short delay to allow download
            setTimeout(function () {
                var iWidth = 1000;
                var iHeight = 800;
                var iLeft = (screen.width - iWidth) / 2;
                var iTop = (screen.height - iHeight) / 2;

                var sWindowFeatures = "width=" + iWidth + ",height=" + iHeight +
                    ",left=" + iLeft + ",top=" + iTop +
                    ",resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no";

                window.open(sOutlookWebURL, 'OutlookCompose', sWindowFeatures);
            }, 500);

            MessageToast.show("PDF file downloaded. Opening Outlook - please attach the file!");
        },

        /**
         * Generate PDF file from carrier data and download it
         * @param {Array} aData - Array of carrier inspection records
         * @param {string} sStartDate - Start date of report
         * @param {string} sEndDate - End date of report
         * @param {string} sFileName - Name of the file to download
         */
        _generatePDFFile: function (aData, sStartDate, sEndDate, sFileName) {
            var that = this;

            // Use pdfMakeLoader to load the libraries
            pdfMakeLoader.load().then(function (pdfMake) {
                console.log("pdfMake loaded successfully via loader");
                that._createPDF(aData, sStartDate, sEndDate, sFileName);
            }).catch(function (error) {
                console.error("Failed to load pdfMake:", error);
                MessageBox.error("Failed to load PDF library: " + error.message);
            });
        },

        /**
         * Create and download PDF file using pdfmake
         * @param {Array} aData - Array of carrier inspection records
         * @param {string} sStartDate - Start date of report
         * @param {string} sEndDate - End date of report
         * @param {string} sFileName - Name of the file to download
         */
        _createPDF: function (aData, sStartDate, sEndDate, sFileName) {
            // Calculate statistics
            var iAccepted = aData.filter(function (item) { return item.Status === 'A'; }).length;
            var iRejected = aData.filter(function (item) { return item.Status === 'R'; }).length;

            // Prepare table body
            var tableBody = [];

            // Add table header
            tableBody.push([
                { text: 'S.No', style: 'tableHeader', bold: true },
                { text: 'Document', style: 'tableHeader', bold: true },
                { text: 'Sequence', style: 'tableHeader', bold: true },
                { text: 'Carrier Number', style: 'tableHeader', bold: true },
                { text: 'Carrier Line', style: 'tableHeader', bold: true },
                { text: 'Inspection Codes', style: 'tableHeader', bold: true },
                { text: 'Created By', style: 'tableHeader', bold: true },
                { text: 'Status', style: 'tableHeader', bold: true }
            ]);

            // Add table rows
            aData.forEach(function (oItem) {
                var sStatus = oItem.Status === 'A' ? 'Accepted' : oItem.Status === 'R' ? 'Rejected' : oItem.Status;
                var sStatusColor = oItem.Status === 'A' ? '#107E3E' : oItem.Status === 'R' ? '#C72E2E' : '#000000';

                tableBody.push([
                    oItem.SerialNumber.toString(),
                    oItem.DocumentNo || '',
                    oItem.Sequencenumber || '',
                    oItem.CarrierNumber || '',
                    oItem.CarrierTypeCodeText || '',
                    oItem.CodeValue || '',
                    oItem.CreatedBy || '',
                    { text: sStatus, color: sStatusColor, bold: true }
                ]);
            });

            // Define PDF document
            var docDefinition = {
                pageSize: 'A4',
                pageOrientation: 'landscape',
                pageMargins: [20, 20, 20, 40],
                content: [
                    {
                        text: 'Carrier Inspection Report',
                        style: 'header',
                        alignment: 'left',
                        margin: [0, 0, 0, 10]
                    },
                    {
                        text: 'Period: ' + sStartDate + ' to ' + sEndDate,
                        style: 'subheader',
                        margin: [0, 0, 0, 5]
                    },
                    {
                        text: 'Total: ' + aData.length + ' | Accepted: ' + iAccepted + ' | Rejected: ' + iRejected,
                        style: 'subheader',
                        margin: [0, 0, 0, 15]
                    },
                    {
                        table: {
                            headerRows: 1,
                            widths: [25, 50, 50, 70, 70, 120, 60, 50],
                            body: tableBody
                        },
                        layout: {
                            fillColor: function (rowIndex, node, columnIndex) {
                                return (rowIndex === 0) ? '#0070F2' : (rowIndex % 2 === 0) ? '#f5f5f5' : null;
                            },
                            hLineWidth: function (i, node) {
                                return 0.5;
                            },
                            vLineWidth: function (i, node) {
                                return 0.5;
                            },
                            hLineColor: function (i, node) {
                                return '#cccccc';
                            },
                            vLineColor: function (i, node) {
                                return '#cccccc';
                            }
                        }
                    }
                ],
                footer: function (currentPage, pageCount) {
                    return {
                        columns: [
                            {
                                text: 'Page ' + currentPage + ' of ' + pageCount,
                                alignment: 'left',
                                margin: [20, 0, 0, 0],
                                fontSize: 8
                            },
                            {
                                text: 'Generated on: ' + new Date().toLocaleString(),
                                alignment: 'right',
                                margin: [0, 0, 20, 0],
                                fontSize: 8
                            }
                        ]
                    };
                },
                styles: {
                    header: {
                        fontSize: 18,
                        bold: true,
                        color: '#000000'
                    },
                    subheader: {
                        fontSize: 10,
                        color: '#666666'
                    },
                    tableHeader: {
                        color: '#ffffff',
                        fillColor: '#0070F2',
                        fontSize: 9
                    }
                },
                defaultStyle: {
                    fontSize: 8
                }
            };

            // Create and download PDF
            pdfMake.createPdf(docDefinition).download(sFileName);
        },

        /**
         * Generate email body with attachment instruction
         * @param {Array} aData - Array of carrier inspection records
         * @param {string} sStartDate - Start date of report
         * @param {string} sEndDate - End date of report
         * @param {string} sFileName - Name of the Excel file
         * @returns {string} Email body text
         */
        _generateEmailBodyWithAttachment: function (aData, sStartDate, sEndDate, sFileName) {
            // Count statistics
            var iAccepted = aData.filter(function (item) { return item.Status === 'A'; }).length;
            var iRejected = aData.filter(function (item) { return item.Status === 'R'; }).length;

            var sBody = "Dear Team,\n\n";
            sBody += "Please find attached the Carrier Inspection Report.\n\n";
            sBody += "Period: " + sStartDate + " to " + sEndDate + "\n";
            sBody += "Total: " + aData.length + " | Accepted: " + iAccepted + " | Rejected: " + iRejected + "\n\n";
            sBody += "Best regards,\n";
            sBody += "Carrier Analytics System";

            return sBody;
        },

        /**
         * Generate formatted HTML email body with carrier inspection data
         * @param {Array} aData - Array of carrier inspection records
         * @param {string} sStartDate - Start date of report
         * @param {string} sEndDate - End date of report
         * @returns {string} Formatted HTML email body
         */
        _generateEmailBodyHTML: function (aData, sStartDate, sEndDate) {
            // Count statistics
            var iAccepted = aData.filter(function (item) { return item.Status === 'A'; }).length;
            var iRejected = aData.filter(function (item) { return item.Status === 'R'; }).length;

            var sHTML = '<div style="font-family: Arial, sans-serif;">';
            sHTML += '<h2 style="color: #0070F2;">Carrier Inspection Report</h2>';
            sHTML += '<p><strong>Report Period:</strong> ' + sStartDate + ' to ' + sEndDate + '</p>';
            sHTML += '<p><strong>Total Records:</strong> ' + aData.length + '</p>';

            // Summary section
            sHTML += '<div style="background-color: #F5F5F5; padding: 15px; margin: 10px 0; border-left: 4px solid #0070F2;">';
            sHTML += '<h3 style="margin-top: 0;">Summary</h3>';
            sHTML += '<ul style="margin: 0;">';
            sHTML += '<li><strong>Accepted:</strong> <span style="color: #107E3E;">' + iAccepted + '</span></li>';
            sHTML += '<li><strong>Rejected:</strong> <span style="color: #C72E2E;">' + iRejected + '</span></li>';
            sHTML += '</ul>';
            sHTML += '</div>';

            // Data table
            sHTML += '<table style="width: 100%; border-collapse: collapse; margin-top: 20px;" border="1">';
            sHTML += '<thead>';
            sHTML += '<tr style="background-color: #0070F2; color: white;">';
            sHTML += '<th style="padding: 10px; text-align: left;">S.No</th>';
            sHTML += '<th style="padding: 10px; text-align: left;">Document</th>';
            sHTML += '<th style="padding: 10px; text-align: left;">Sequence</th>';
            sHTML += '<th style="padding: 10px; text-align: left;">Carrier Number</th>';
            sHTML += '<th style="padding: 10px; text-align: left;">Carrier Line</th>';
            sHTML += '<th style="padding: 10px; text-align: left;">Inspection Codes</th>';
            sHTML += '<th style="padding: 10px; text-align: left;">Created By</th>';
            sHTML += '<th style="padding: 10px; text-align: left;">Status</th>';
            sHTML += '</tr>';
            sHTML += '</thead>';
            sHTML += '<tbody>';

            // Table rows
            aData.forEach(function (oItem, index) {
                var sStatus = oItem.Status === 'A' ? 'Accepted' : oItem.Status === 'R' ? 'Rejected' : oItem.Status;
                var sStatusColor = oItem.Status === 'A' ? '#107E3E' : oItem.Status === 'R' ? '#C72E2E' : '#000000';
                var sRowBg = index % 2 === 0 ? '#FFFFFF' : '#F9F9F9';

                sHTML += '<tr style="background-color: ' + sRowBg + ';">';
                sHTML += '<td style="padding: 8px;">' + oItem.SerialNumber + '</td>';
                sHTML += '<td style="padding: 8px;">' + (oItem.DocumentNo || '') + '</td>';
                sHTML += '<td style="padding: 8px;">' + (oItem.Sequencenumber || '') + '</td>';
                sHTML += '<td style="padding: 8px;"><strong>' + oItem.CarrierNumber + '</strong></td>';
                sHTML += '<td style="padding: 8px;">' + (oItem.CarrierTypeCodeText || '') + '</td>';
                sHTML += '<td style="padding: 8px;">' + (oItem.CodeValue || '') + '</td>';
                sHTML += '<td style="padding: 8px;">' + (oItem.CreatedBy || '') + '</td>';
                sHTML += '<td style="padding: 8px; color: ' + sStatusColor + '; font-weight: bold;">' + sStatus + '</td>';
                sHTML += '</tr>';
            });

            sHTML += '</tbody>';
            sHTML += '</table>';

            // Footer
            sHTML += '<p style="margin-top: 20px; font-size: 12px; color: #666;">';
            sHTML += '<strong>Generated on:</strong> ' + new Date().toLocaleString() + '<br>';
            sHTML += 'This is an automated report from Carrier Analytics Application.';
            sHTML += '</p>';
            sHTML += '</div>';

            return sHTML;
        },

        /**
         * Generate formatted plain text email body (fallback)
         * @param {Array} aData - Array of carrier inspection records
         * @param {string} sStartDate - Start date of report
         * @param {string} sEndDate - End date of report
         * @returns {string} Formatted email body text
         */
        _generateEmailBody: function (aData, sStartDate, sEndDate) {
            var sBody = "Carrier Inspection Report\n";
            sBody += "=================================\n\n";
            sBody += "Report Period: " + sStartDate + " to " + sEndDate + "\n";
            sBody += "Total Records: " + aData.length + "\n\n";

            // Count statistics
            var iAccepted = aData.filter(function (item) { return item.Status === 'A'; }).length;
            var iRejected = aData.filter(function (item) { return item.Status === 'R'; }).length;

            sBody += "Summary:\n";
            sBody += "  - Accepted: " + iAccepted + "\n";
            sBody += "  - Rejected: " + iRejected + "\n\n";
            sBody += "=================================\n\n";

            // Table header
            sBody += "S.No | Document | Sequence | Carrier Number | Carrier Line | Inspection Codes | Created By | Status\n";
            sBody += "--------------------------------------------------------------------------------------------------------------\n";

            // Table rows
            aData.forEach(function (oItem) {
                var sStatus = oItem.Status === 'A' ? 'Accepted' : oItem.Status === 'R' ? 'Rejected' : oItem.Status;
                sBody += oItem.SerialNumber + " | ";
                sBody += (oItem.DocumentNo || "") + " | ";
                sBody += (oItem.Sequencenumber || "") + " | ";
                sBody += oItem.CarrierNumber + " | ";
                sBody += (oItem.CarrierTypeCodeText || "") + " | ";
                sBody += (oItem.CodeValue || "") + " | ";
                sBody += (oItem.CreatedBy || "") + " | ";
                sBody += sStatus + "\n";
            });

            sBody += "\n=================================\n";
            sBody += "Generated on: " + new Date().toLocaleString() + "\n";
            sBody += "\nThis is an automated report from Carrier Analytics Application.";

            return sBody;
        },

        /**
         * Format date as dd/MM/yyyy for display
         * @param {Date} oDate - Date to format
         * @returns {string} Formatted date string
         */
        _formatDateForDisplay: function (oDate) {
            var sDay = ("0" + oDate.getDate()).slice(-2);
            var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
            var sYear = oDate.getFullYear();
            return sDay + "/" + sMonth + "/" + sYear;
        },

        /**
         * Format date as dd/mm/yy for mobile display (short year format)
         * @param {Date} oDate - Date to format
         * @returns {string} Formatted date string with short year
         */
        _formatDateForDisplayMobile: function (oDate) {
            var sDay = ("0" + oDate.getDate()).slice(-2);
            var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
            var sYear = String(oDate.getFullYear()).slice(-2); // Get last 2 digits of year
            return sDay + "/" + sMonth + "/" + sYear;
        },

        /**
         * Convert date string from YYYY-MM-DD or dd/MM/yyyy format to short year format (yy)
         * @param {string} sDateString - Date string in YYYY-MM-DD or dd/MM/yyyy format
         * @returns {string} Date string with short year format
         */
        _convertToShortYear: function (sDateString) {
            // Handle date range (e.g., "2025-11-03 - 2025-11-17" or "03/11/2025 - 17/11/2025")
            if (sDateString.indexOf(" - ") !== -1) {
                var aDates = sDateString.split(" - ");
                var sStartShort = this._convertSingleDateToShortYear(aDates[0]);
                var sEndShort = this._convertSingleDateToShortYear(aDates[1]);
                return sStartShort + " - " + sEndShort;
            }
            return this._convertSingleDateToShortYear(sDateString);
        },

        /**
         * Convert single date string to short year format
         * @param {string} sDate - Date string in YYYY-MM-DD or dd/MM/yyyy format
         * @returns {string} Date string with short year
         */
        _convertSingleDateToShortYear: function (sDate) {
            // Check if format is YYYY-MM-DD
            if (sDate.indexOf("-") !== -1) {
                var aParts = sDate.split("-");
                var sYear = aParts[0].slice(-2); // Get last 2 digits
                return aParts[2] + "/" + aParts[1] + "/" + sYear;
            }
            // Check if format is dd/MM/yyyy
            if (sDate.indexOf("/") !== -1) {
                var aDateParts = sDate.split("/");
                if (aDateParts[2].length === 4) {
                    var sShortYear = aDateParts[2].slice(-2);
                    return aDateParts[0] + "/" + aDateParts[1] + "/" + sShortYear;
                }
            }
            return sDate; // Return as-is if format not recognized
        },

        /**
         * Format date for OData query (YYYY-MM-DD)
         * @param {Date} oDate - Date to format
         * @returns {string} Formatted date string for OData
         */
        _formatDateForOData: function (oDate) {
            var sYear = oDate.getFullYear();
            var sMonth = ("0" + (oDate.getMonth() + 1)).slice(-2);
            var sDay = ("0" + oDate.getDate()).slice(-2);
            return sYear + "-" + sMonth + "-" + sDay;
        },

        /**
         * Add serial numbers to array of records
         * @param {Array} aData - Array of data records_updateResponsiveVisibility
         * @returns {Array} Array with SerialNumber property added to each record
         */
        _addSerialNumbers: function (aData) {
            return aData.map(function (oItem, iIndex) {
                oItem.SerialNumber = iIndex + 1;
                return oItem;
            });
        },

        /**
         * Fetch carrier inspection data from CarrierInspReportSet
         * Filters by date range (InspectionDate between start and end dates)
         */
        _fetchCarrierData: function () {
            console.log("_fetchCarrierData - START");

            var oViewModel = this.getView().getModel("viewModel");
            var oModel = this.getOwnerComponent().getModel();

            console.log("_fetchCarrierData - ViewModel:", oViewModel);
            console.log("_fetchCarrierData - OData Model:", oModel);

            oViewModel.setProperty("/isLoadingTable", true);
            oViewModel.setProperty("/carrierData", []);

            // Get date range from view model
            var sStartDate = oViewModel.getProperty("/startDate");
            var sEndDate = oViewModel.getProperty("/endDate");

            console.log("_fetchCarrierData - Start Date:", sStartDate);
            console.log("_fetchCarrierData - End Date:", sEndDate);

            // Build the URL path with filter
            var sPath = "/CarrierInspReportSet";

            // Create filter for InspectionDate range
            var aFilters = [
                new Filter("InspectionDate", FilterOperator.BT, sStartDate, sEndDate)
            ];

            console.log("_fetchCarrierData - Path:", sPath);
            console.log("_fetchCarrierData - Filters:", aFilters);

            oModel.read(sPath, {
                filters: aFilters,
                urlParameters: {
                    "$format": "json"
                },
                success: function (oData) {
                    console.log("_fetchCarrierData - SUCCESS Response:", oData);
                    oViewModel.setProperty("/isLoadingTable", false);

                    if (oData.results && oData.results.length > 0) {
                        // Add serial numbers to the data
                        var aDataWithSerialNumbers = this._addSerialNumbers(oData.results);
                        // Store all carrier data for filter functionality
                        oViewModel.setProperty("/allCarrierData", aDataWithSerialNumbers);
                        oViewModel.setProperty("/carrierData", aDataWithSerialNumbers);

                        // Update status counts based on loaded data
                        this._updateStatusCounts(aDataWithSerialNumbers);

                        MessageToast.show(oData.results.length + " carrier record(s) loaded successfully");
                    } else {
                        oViewModel.setProperty("/allCarrierData", []);
                        oViewModel.setProperty("/carrierData", []);

                        // Reset counts when no data
                        this._updateStatusCounts([]);

                        MessageToast.show("No carrier data found for selected date range");
                    }
                }.bind(this),
                error: function (oError) {
                    console.log("_fetchCarrierData - ERROR Response:", oError);

                    oViewModel.setProperty("/isLoadingTable", false);
                    oViewModel.setProperty("/carrierData", []);

                    console.error("Error fetching carrier data:", oError);

                    var sErrorMessage = "Error loading carrier data";
                    if (oError.responseText) {
                        try {
                            var oErrorResponse = JSON.parse(oError.responseText);
                            if (oErrorResponse.error && oErrorResponse.error.message && oErrorResponse.error.message.value) {
                                sErrorMessage = oErrorResponse.error.message.value;
                            }
                        } catch (e) {
                            // Use default error message
                        }
                    }

                    MessageBox.error(sErrorMessage);
                }.bind(this)
            });
        },

        /**
         * Fetch and calculate accepted and rejected counts from InspectionHeaderSet
         * Uses the same entity set as Main view to ensure consistent counts
         */
        _fetchStatusCounts: function () {
            console.log("_fetchStatusCounts - START");

            var oViewModel = this.getView().getModel("viewModel");
            var oModel = this.getOwnerComponent().getModel();

            // Get date range from view model
            var sStartDate = oViewModel.getProperty("/startDate");
            var sEndDate = oViewModel.getProperty("/endDate");

            console.log("_fetchStatusCounts - Start Date:", sStartDate);
            console.log("_fetchStatusCounts - End Date:", sEndDate);

            // Use InspectionHeaderSet to get accurate counts (same as Main view)
            var sPath = "/InspectionHeaderSet";

            // Create filter for InspectionDate range
            var aFilters = [
                new Filter("InspectionDate", FilterOperator.BT, sStartDate, sEndDate)
            ];

            oModel.read(sPath, {
                filters: aFilters,
                urlParameters: {
                    "$format": "json"
                },
                success: function (oData) {
                    console.log("_fetchStatusCounts - SUCCESS Response:", oData);

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

                    oViewModel.setProperty("/acceptedCount", iAcceptedCount);
                    oViewModel.setProperty("/rejectedCount", iRejectedCount);

                    console.log("Status counts - Accepted:", iAcceptedCount, "Rejected:", iRejectedCount);
                }.bind(this),
                error: function (oError) {
                    console.error("Error fetching status counts:", oError);
                    oViewModel.setProperty("/acceptedCount", 0);
                    oViewModel.setProperty("/rejectedCount", 0);
                }.bind(this)
            });
        },

        /**
         * Fetch inspection codes reference data from InspectCodesSet
         * This provides the code descriptions for reference
         */
        _fetchInspectionCodes: function () {
            console.log("_fetchInspectionCodes - START");

            var oViewModel = this.getView().getModel("viewModel");
            var oModel = this.getOwnerComponent().getModel();

            console.log("_fetchInspectionCodes - OData Model:", oModel);

            oViewModel.setProperty("/isLoadingCodes", true);
            oViewModel.setProperty("/codeReference", []);
            oViewModel.setProperty("/allCodeReference", []);

            var sPath = "/InspectCodesSet";

            console.log("_fetchInspectionCodes - Path:", sPath);

            oModel.read(sPath, {
                urlParameters: {
                    "$format": "json"
                },
                success: function (oData) {
                    console.log("_fetchInspectionCodes - SUCCESS Response:", oData);
                    oViewModel.setProperty("/isLoadingCodes", false);

                    if (oData.results && oData.results.length > 0) {
                        // Store all codes for search functionality
                        oViewModel.setProperty("/allCodeReference", oData.results);
                        oViewModel.setProperty("/codeReference", oData.results);
                        MessageToast.show(oData.results.length + " inspection code(s) loaded");
                    } else {
                        oViewModel.setProperty("/allCodeReference", []);
                        oViewModel.setProperty("/codeReference", []);
                    }
                }.bind(this),
                error: function (oError) {
                    oViewModel.setProperty("/isLoadingCodes", false);
                    oViewModel.setProperty("/allCodeReference", []);
                    oViewModel.setProperty("/codeReference", []);

                    console.error("Error fetching inspection codes:", oError);

                    var sErrorMessage = "Error loading inspection codes";
                    if (oError.responseText) {
                        try {
                            var oErrorResponse = JSON.parse(oError.responseText);
                            if (oErrorResponse.error && oErrorResponse.error.message && oErrorResponse.error.message.value) {
                                sErrorMessage = oErrorResponse.error.message.value;
                            }
                        } catch (e) {
                            // Use default error message
                        }
                    }

                    MessageBox.error(sErrorMessage);
                }.bind(this)
            });
        },

        /**
         * Search codes in the reference table (supports live search)
         * Filters codes based on search query (case insensitive)
         * Works with both 'search' (Enter key) and 'liveChange' (as you type) events
         * @param {sap.ui.base.Event} oEvent - Search or liveChange event
         */
        onSearchCodes: function (oEvent) {
            // Get query from either search event (query) or liveChange event (newValue)
            var sQuery = oEvent.getParameter("query") || oEvent.getParameter("newValue") || "";
            var oViewModel = this.getView().getModel("viewModel");
            var aAllCodes = oViewModel.getProperty("/allCodeReference");

            if (!sQuery) {
                // Show all codes if search is empty
                oViewModel.setProperty("/codeReference", aAllCodes);
                return;
            }

            // Filter codes based on search query (case insensitive, supports partial matching)
            // Searches in both code and code description
            var sQueryLower = sQuery.toLowerCase();
            var aFilteredCodes = aAllCodes.filter(function (oCode) {
                var sCode = (oCode.InspectionCode || "").toLowerCase();
                var sCodeText = (oCode.InspectionCodeText || "").toLowerCase();

                return sCode.indexOf(sQueryLower) !== -1 || sCodeText.indexOf(sQueryLower) !== -1;
            });

            oViewModel.setProperty("/codeReference", aFilteredCodes);

            // Show toast only on search event (Enter key), not on every keystroke
            if (oEvent.getId() === "search") {
                if (aFilteredCodes.length === 0) {
                    MessageToast.show("No codes found matching '" + sQuery + "'");
                }
            }
        },

        /**
         * Filter carrier data by carrier line (supports live search)
         * Filters carriers based on search query (case insensitive)
         * Works with both 'search' (Enter key) and 'liveChange' (as you type) events
         * @param {sap.ui.base.Event} oEvent - Search or liveChange event
         */
        onFilterCarrierLine: function () {
            // Apply filters on search or liveChange
            this._applyFilters();
        },

        /**
         * Filter carrier data by CreatedBy (supports live search)
         * Filters carriers based on search query (case insensitive)
         * Works with both 'search' (Enter key) and 'liveChange' (as you type) events
         * @param {sap.ui.base.Event} oEvent - Search or liveChange event
         */
        onFilterCreatedBy: function () {
            // Apply filters on search or liveChange
            this._applyFilters();
        },

        /**
         * Filter carrier data by Status (supports live search)
         * Filters carriers based on search query (case insensitive)
         * Works with both 'search' (Enter key) and 'liveChange' (as you type) events
         * @param {sap.ui.base.Event} oEvent - Search or liveChange event
         */
        onFilterStatus: function () {
            this._applyFilters();
        },
        /**
         * Apply combined filters for carrier line and CreatedBy
         * Filters are applied simultaneously (AND logic)
         * Uses single shared filter fields for both desktop and mobile
         * Updates status counts dynamically based on filtered data
         */
        _applyFilters: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var aAllCarriers = oViewModel.getProperty("/allCarrierData");

            if (!aAllCarriers || aAllCarriers.length === 0) {
                // No data to filter
                this._updateStatusCounts([]);
                return;
            }

            // Get filter values from shared filter fields
            var oCarrierLineFilter = this.byId("carrierLineFilter");
            var oCreatedByFilter = this.byId("createdByFilter");
            var oStatusFilter = this.byId("StatusFilter");

            var sCarrierLineQuery = oCarrierLineFilter ? (oCarrierLineFilter.getValue() || "").trim() : "";
            var sCreatedByQuery = oCreatedByFilter ? (oCreatedByFilter.getValue() || "").trim() : "";
            var sStatusQuery = oStatusFilter ? (oStatusFilter.getValue() || "").trim() : "";

            // Convert to lowercase for case-insensitive search
            var sCarrierLineQueryLower = sCarrierLineQuery.toLowerCase();
            var sCreatedByQueryLower = sCreatedByQuery.toLowerCase();
            var sStatusQueryLower = sStatusQuery.toLowerCase();

            console.log("Filter inputs - CarrierLine:", sCarrierLineQuery, "CreatedBy:", sCreatedByQuery);

            // If both filters are empty, show all data
            if (!sCarrierLineQuery && !sCreatedByQuery && !sStatusQuery) {
                oViewModel.setProperty("/carrierData", aAllCarriers);
                this._updateStatusCounts(aAllCarriers);
                console.log("No filters applied, showing all", aAllCarriers.length, "records");
                return;
            }

            // Apply filters
            var aFilteredCarriers = aAllCarriers.filter(function (oCarrier) {
                var sCarrierLine = (oCarrier.CarrierTypeCodeText || "").toLowerCase();
                var sCreatedBy = (oCarrier.CreatedBy || "").toLowerCase();
                var sStatusCode = (oCarrier.Status || "").toLowerCase();

                var sStatusText = "";
                if (sStatusCode === "a") {
                    sStatusText = "accepted";
                } else if (sStatusCode === "r") {
                    sStatusText = "rejected";
                }

                var bCarrierLineMatch = true;
                var bCreatedByMatch = true;
                var bStatusMatch = true;

                // Only filter by carrier line if query is provided
                if (sCarrierLineQueryLower) {
                    bCarrierLineMatch = sCarrierLine.indexOf(sCarrierLineQueryLower) !== -1;
                }

                // Only filter by created by if query is provided
                if (sCreatedByQueryLower) {
                    bCreatedByMatch = sCreatedBy.indexOf(sCreatedByQueryLower) !== -1;
                }
                if (sStatusQueryLower) {
                    bStatusMatch =
                        sStatusCode.indexOf(sStatusQueryLower) !== -1 ||
                        sStatusText.indexOf(sStatusQueryLower) !== -1;
                }

                return bCarrierLineMatch && bCreatedByMatch && bStatusMatch;
            });

            // Create copies of filtered results before re-numbering to avoid mutating original data
            aFilteredCarriers = aFilteredCarriers.map(function (oCarrier, iIndex) {
                // Create a shallow copy of the carrier object
                var oCarrierCopy = Object.assign({}, oCarrier);
                // Assign new serial number for display
                oCarrierCopy.SerialNumber = iIndex + 1;
                return oCarrierCopy;
            });

            oViewModel.setProperty("/carrierData", aFilteredCarriers);
            this._updateStatusCounts(aFilteredCarriers);

            console.log("Filter applied - Results:", aFilteredCarriers.length, "out of", aAllCarriers.length);
        },

        /**
         * Update status counts (accepted, rejected, total) based on current data
         * @param {Array} aData - Array of carrier data to count
         */
        _updateStatusCounts: function (aData) {
            var oViewModel = this.getView().getModel("viewModel");

            var iAcceptedCount = 0;
            var iRejectedCount = 0;

            if (aData && aData.length > 0) {
                aData.forEach(function (oItem) {
                    if (oItem.Status === "A") {
                        iAcceptedCount++;
                    } else if (oItem.Status === "R") {
                        iRejectedCount++;
                    }
                });
            }

            var iTotalCount = aData ? aData.length : 0;

            oViewModel.setProperty("/acceptedCount", iAcceptedCount);
            oViewModel.setProperty("/rejectedCount", iRejectedCount);
            oViewModel.setProperty("/totalCount", iTotalCount);

            console.log("Status counts updated - Accepted:", iAcceptedCount, "Rejected:", iRejectedCount, "Total:", iTotalCount);
        },

        /**
         * Handler for carrier selection in the table
         * Can be extended to show detailed information about selected carrier
         * @param {sap.ui.base.Event} oEvent - Selection event
         */
        onCarrierSelect: function (/* oEvent */) {
            // Selection handler - can be extended in the future
            // Currently no action is taken on selection
        },

        /**
         * Update visibility flags based on current screen width
         * Phone breakpoint: < 600px
         * Tablet/Desktop: >= 600px
         * This allows responsive behavior when browser window is resized
         */
        _updateResponsiveVisibility: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var iWidth = window.innerWidth || document.documentElement.clientWidth;

            // SAP UI5 standard breakpoint: Phone < 600px
            var bIsPhoneSize = iWidth < 600;

            oViewModel.setProperty("/showTableView", !bIsPhoneSize);
            oViewModel.setProperty("/showListView", bIsPhoneSize);

            console.log("Responsive visibility updated - Width:", iWidth, "Phone mode:", bIsPhoneSize);
        }

    });
});
