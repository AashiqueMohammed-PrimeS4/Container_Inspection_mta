sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "insptrack/util/UserHelper",
    "insptrack/util/DescriptionHelper",
    "insptrack/util/FilterHelper",
    "insptrack/util/ErrorHandler",
    "insptrack/service/InspectionCodeService",
    "insptrack/service/ODataService",
    "insptrack/service/ValidationService",
    "insptrack/service/ImageService",
    "insptrack/service/PDFService"
], (Controller, JSONModel, MessageToast, MessageBox, UserHelper, DescriptionHelper, FilterHelper, ErrorHandler, InspectionCodeService, ODataService, ValidationService, ImageService, PDFService) => {
    "use strict";

    return Controller.extend("insptrack.controller.Main", {

        onInit() {
            this._wizard = this.byId("ContainerInspectionWizard");
            this._oNavContainer = this.byId("inspectionWizardNavContainer");
            this._initializeModel();
            this._loadCarrierLines();
            this._loadCarrierTypes();
            this._loadInspectionCodes();
            this._checkDefectModuleLicense();
            this._wizard.attachStepActivate(this.onWizardStepActivate, this);
        },

        _initializeModel() {
            this.oModel = new JSONModel({
                document: "",
                sequenceNumber: "",
                carrierNumber: "",
                carrierLine: "",
                carrierType: "",
                showAcceptRejectButtons: false,
                showCarrierLineCombo: true,
                imageStepTitle: "Take Photos",
                imageStepMessage: "Take photos of the container.",
                imageStepType: "Information",
                totalImages: 0,
                skipStep2: false,
                currentImageType: "B",
                beforeImageCount: 0,
                afterImageCount: 0,
                beforeImages: [],
                afterImages: [],
                cameraActive: true,
                imageCapured: false,
                cameraStatusText: "Position camera and tap the red button to capture",
                defectCodes: {},
                inspectionCodes: [],
                recordExists: false,
                nextStep: "InspectionCodesStep",
                existingInspectionDate: null,
                hasBeforeImg: false,
                hasAfterImg: false,
                imageType: "B",
                showInspectionCodesStep: true,
                isAccepted: false,
                isRejected: false,
                recordStatus: "",
                isRejectEnabled: true,
                savedCodes: [],
                isAcceptButtonEnabled: true,
                areCheckboxesEnabled: true,
                showCarrierTypeCombo: true,
                // Step 2 - container scan & defect tokenizer
                containerImageSrc: "",
                containerImageBase64: "",
                showContainerImage: false,
                isAnalyzing: false,
                showDefectSection: false,
                newDefectText: "",
                isTokenizerEditable: true,
                aiTokenUsage: null,
                defectModuleEnabled: false,
                isCheckingDefectLicense: false
            });
            this.getView().setModel(this.oModel);
            var oViewModel = new JSONModel({ hasPreview: false });
            this.getView().setModel(oViewModel, "viewModel");
        },

        // ========================================
        // HELPER METHODS - COMMON OPERATIONS
        // ========================================

        _createHeaderFilters() {
            return FilterHelper.createHeaderFilters(
                this.oModel.getProperty("/document"),
                this.oModel.getProperty("/sequenceNumber"),
                this.oModel.getProperty("/carrierNumber")
            );
        },

        _getTextToCodeMap() {
            const aInspectionCodesLeft = this.oModel.getProperty("/inspectionCodesLeft") || [];
            const aInspectionCodesRight = this.oModel.getProperty("/inspectionCodesRight") || [];
            return InspectionCodeService.getTextToCodeMap(aInspectionCodesLeft, aInspectionCodesRight);
        },

        _getCarrierTypeDescription(sCarrierTypeCode) {
            const aCarrierTypes = this.oModel.getProperty("/CarrierTypes") || [];
            return DescriptionHelper.getCarrierTypeDescription(aCarrierTypes, sCarrierTypeCode);
        },

        _getCarrierLineDescription(sCarrierLineCode) {
            const aCarrierLines = this.oModel.getProperty("/CarrierLines") || [];
            return DescriptionHelper.getCarrierLineDescription(aCarrierLines, sCarrierLineCode);
        },

        _buildSelectedCodes(oDefectCodes) {
            const textToCodeMap = this._getTextToCodeMap();
            return InspectionCodeService.buildSelectedCodes(
                oDefectCodes,
                textToCodeMap,
                this.oModel.getProperty("/document"),
                this.oModel.getProperty("/sequenceNumber"),
                this.oModel.getProperty("/carrierNumber")
            );
        },

        _createDeepEntityPayload(aSelectedCodes, sStatus) {
            return InspectionCodeService.createDeepEntityPayload(
                aSelectedCodes,
                sStatus,
                this.oModel.getProperty("/document"),
                this.oModel.getProperty("/sequenceNumber"),
                this.oModel.getProperty("/carrierNumber"),
                this.oModel.getProperty("/carrierLine"),
                this.oModel.getProperty("/carrierType")
            );
        },

        _parseErrorMessage(oError) {
            return ErrorHandler.parseErrorMessage(oError);
        },

        async _loadPdfMake() {
            await PDFService.loadPdfMake();
        },

        _cleanupCamera() {
            ImageService.cleanupCamera();
            ImageService.clearCameraContainer("cameraVideoContainer");
            this._stream = null;
            this._videoElement = null;
        },

        _clearInputFields() {
            this.byId("documentInput").setValue("");
            this.byId("sequenceInput").setValue("");
            this.byId("carrierInput").setValue("");
            this.byId("carrierLineCombo").setValue("");
            this.byId("carrierTypeCombo").setValue("");

            this.oModel.setProperty("/document", "");
            this.oModel.setProperty("/sequenceNumber", "");
            this.oModel.setProperty("/carrierNumber", "");
            this.oModel.setProperty("/carrierLine", "");
            this.oModel.setProperty("/carrierType", "");
        },

        _resetFlags() {
            this.oModel.setProperty("/recordExists", false);
            this.oModel.setProperty("/hasBeforeImg", false);
            this.oModel.setProperty("/hasAfterImg", false);
            this.oModel.setProperty("/showCarrierLineCombo", true);
            this.oModel.setProperty("/showCarrierTypeCombo", true);
            this.oModel.setProperty("/isRejected", false);
            this.oModel.setProperty("/recordStatus", "");
        },

        _validateStep1() {
            const oData = {
                document: this.oModel.getProperty("/document"),
                sequenceNumber: this.oModel.getProperty("/sequenceNumber"),
                carrierNumber: this.oModel.getProperty("/carrierNumber"),
                carrierLine: this.oModel.getProperty("/carrierLine"),
                carrierType: this.oModel.getProperty("/carrierType")
            };
            const showCarrierLineCombo = this.oModel.getProperty("/showCarrierLineCombo");
            const showCarrierTypeCombo = this.oModel.getProperty("/showCarrierTypeCombo");

            const oStep1 = this.byId("DocumentDetailsStep");
            const bAllRequiredFieldsFilled = ValidationService.validateStep1(oData, showCarrierLineCombo, showCarrierTypeCombo);

            if (bAllRequiredFieldsFilled) {
                if (!oStep1.getValidated()) {
                    oStep1.setValidated(true);
                    console.log("Step 1 validated - all required fields filled");
                }
            } else {
                if (oStep1.getValidated()) {
                    oStep1.setValidated(false);
                    console.log("Step 1 invalidated - required fields missing");
                }
            }
        },

        // ========================================
        // DATA LOADING
        // ========================================

        _loadCarrierLines() {
            const oDataModel = this.getOwnerComponent().getModel();
            ODataService.loadCarrierLines(oDataModel)
                .then((results) => {
                    this.oModel.setProperty("/CarrierLines", results);
                })
                .catch((oError) => {
                    OC
                    MessageBox.error(this._parseErrorMessage(oError) || "Failed to load carrier lines");
                });
        },

        _loadCarrierTypes() {
            const oDataModel = this.getOwnerComponent().getModel();
            ODataService.loadCarrierTypes(oDataModel)
                .then((results) => {
                    this.oModel.setProperty("/CarrierTypes", results);
                })
                .catch((oError) => {
                    MessageBox.error(this._parseErrorMessage(oError) || "Failed to load carrier types");
                });
        },

        _loadInspectionCodes() {
            const oDataModel = this.getOwnerComponent().getModel();
            ODataService.loadInspectionCodes(oDataModel)
                .then((results) => {
                    const processedData = InspectionCodeService.processInspectionCodes(results);
                    this.oModel.setProperty("/defectCodes", processedData.defectCodes);
                    this.oModel.setProperty("/inspectionCodesLeft", processedData.inspectionCodesLeft);
                    this.oModel.setProperty("/inspectionCodesRight", processedData.inspectionCodesRight);
                })
                .catch((oError) => {
                    MessageBox.error(this._parseErrorMessage(oError) || "Failed to load inspection codes");
                });
        },

        // ========================================
        // STEP 1: DOCUMENT DETAILS
        // ========================================

        onDocumentDetailsChange(oEvent) {
            const sDocument = this.byId("documentInput").getValue();
            const sSequence = this.byId("sequenceInput").getValue();
            const sCarrier = this.byId("carrierInput").getValue();

            let sCarrierLineCode = this.oModel.getProperty("/carrierLine");
            let sCarrierTypeCode = this.oModel.getProperty("/carrierType");
            let bCarrierLineChanged = false;
            let bCarrierTypeChanged = false;

            if (oEvent && oEvent.getSource && oEvent.getSource().getSelectedKey) {
                const oComboBox = oEvent.getSource();
                const sSelectedKey = oComboBox.getSelectedKey();
                const sComboId = oComboBox.getId();

                if (sComboId.includes("carrierLineCombo")) {
                    this.oModel.setProperty("/carrierLine", sSelectedKey);
                    sCarrierLineCode = sSelectedKey;
                    bCarrierLineChanged = true;
                } else if (sComboId.includes("carrierTypeCombo")) {
                    this.oModel.setProperty("/carrierType", sSelectedKey);
                    sCarrierTypeCode = sSelectedKey;
                    bCarrierTypeChanged = true;
                }
            }

            console.log("Validation check:", {
                document: sDocument,
                sequence: sSequence,
                carrier: sCarrier,
                carrierLine: sCarrierLineCode,
                carrierType: sCarrierTypeCode
            });

            const oStep1 = this.byId("DocumentDetailsStep");

            // Check if first 3 fields are filled to trigger record existence check
            const bFirst3FieldsFilled = ValidationService.validateFirst3Fields(sDocument, sSequence, sCarrier);

            if (bFirst3FieldsFilled) {
                this.oModel.setProperty("/document", sDocument);
                this.oModel.setProperty("/sequenceNumber", sSequence);
                this.oModel.setProperty("/carrierNumber", sCarrier);

                // Call record check to determine if record exists and if carrier line/type combos should be hidden
                this._checkRecordExists(sDocument, sSequence, sCarrier);
            } else {
                oStep1.setValidated(false);
                console.log("Step 1 invalidated - first 3 fields not complete");
                this._resetFlags();
                this.oModel.setProperty("/showInspectionCodesStep", true);
            }

            // If carrier line or carrier type changed (and first 3 fields already filled), validate step
            if ((bCarrierLineChanged || bCarrierTypeChanged) && bFirst3FieldsFilled) {
                this._validateStep1();
            }
        },

        _checkRecordExists(sDocument, sSequence, sCarrier) {
            const oModel = this.getOwnerComponent().getModel();

            ODataService.checkRecordExists(oModel, sDocument, sSequence, sCarrier)
                .then((oRecord) => {
                    if (oRecord) {
                        this._handleExistingRecord(oRecord);
                    } else {
                        this._handleNewRecord();
                    }
                    this._validateStep1();
                })
                .catch((oError) => {
                    const sErrorMsg = this._parseErrorMessage(oError) || "Validation failed. Please check your inputs.";

                    MessageBox.error(sErrorMsg, {
                        title: "Validation Error",
                        actions: [MessageBox.Action.OK],
                        onClose: () => {
                            this._clearInputFields();
                            this._resetFlags();
                            this.byId("documentInput").focus();
                        }
                    });

                    const oStep1 = this.byId("DocumentDetailsStep");
                    if (oStep1.getValidated()) {
                        oStep1.setValidated(false);
                        console.log("Step 1 invalidated due to validation error");
                    }
                    this._resetFlags();
                });
        },

        _handleExistingRecord(oRecord) {
            console.log("Existing record found:", oRecord);

            this.oModel.setProperty("/recordExists", true);
            this.oModel.setProperty("/existingInspectionDate", oRecord.InspectionDate);
            this.oModel.setProperty("/hasBeforeImg", oRecord.HasBeforeImg);
            this.oModel.setProperty("/hasAfterImg", oRecord.HasAfterImg);
            this.oModel.setProperty("/recordStatus", oRecord.Status);
            this.oModel.setProperty("/carrierLine", oRecord.CarrierLineCode);
            this.oModel.setProperty("/carrierType", oRecord.CarrierTyCode);

            const hasBeforeImg = oRecord.HasBeforeImg === true || oRecord.HasBeforeImg === 'X' || oRecord.HasBeforeImg === 'x';
            const hasAfterImg = oRecord.HasAfterImg === true || oRecord.HasAfterImg === 'X' || oRecord.HasAfterImg === 'x';
            const isRejected = oRecord.Status === 'R';

            // Set rejected flag if status is 'R'
            if (isRejected) {
                this.oModel.setProperty("/isRejected", true);
                console.log("Record status is 'R' - carrier was rejected");
            }

            // Hide carrier line and carrier type combo boxes for existing records with HasBeforeImg (accepted or rejected)
            if (hasBeforeImg) {
                this.oModel.setProperty("/showCarrierLineCombo", false);
                this.oModel.setProperty("/showCarrierTypeCombo", false);
                if (isRejected) {
                    console.log("Carrier line and carrier type combo boxes hidden - rejected record with HasBeforeImg");
                } else {
                    console.log("Carrier line and carrier type combo boxes hidden - existing record with HasBeforeImg");
                }
            }

            // Check if this is a rejected record with before images
            if (isRejected && hasBeforeImg) {
                console.log("Rejected record already has before images - no further action allowed");
                MessageBox.warning("This carrier was rejected so no Images can be taken further", {
                    title: "Rejected Carrier - Complete",
                    onClose: () => {
                        this._clearInputFields();
                        this._resetFlags();
                        const oStep1 = this.byId("DocumentDetailsStep");
                        if (oStep1) {
                            oStep1.setValidated(false);
                        }
                        this.byId("documentInput").focus();
                    }
                });
                return;
            }

            // Check if BOTH before and after images already exist
            if (hasBeforeImg && hasAfterImg) {
                console.log("Record already has both before and after images");
                MessageBox.warning("This record already has both Before and After loading images. No further images can be added.", {
                    title: "Images Already Completed",
                    onClose: () => {
                        this._clearInputFields();
                        this._resetFlags();
                        const oStep1 = this.byId("DocumentDetailsStep");
                        if (oStep1) {
                            oStep1.setValidated(false);
                        }
                        this.byId("documentInput").focus();
                    }
                });
                return;
            }

            if (hasBeforeImg) {
                // Only allow after images if not rejected
                if (!isRejected) {
                    this.oModel.setProperty("/imageStepTitle", "Take Photos");
                    this.oModel.setProperty("/imageStepMessage", "Take photos of the carrier Before/After loading.");
                    this.oModel.setProperty("/imageType", "A");
                    MessageToast.show("Record exists with before images. Ready for after-loading photos.");
                }
            } else {
                this.oModel.setProperty("/imageStepTitle", "Take Photos");
                this.oModel.setProperty("/imageType", "B");
                if (isRejected) {
                    MessageToast.show("Rejected record exists. Ready for before-loading photos only.");
                } else {
                    MessageToast.show("Record exists. Ready for before-loading photos.");
                }
            }
        },

        _handleNewRecord() {
            console.log("New record - proceed with full inspection");

            this._resetFlags();
            this.oModel.setProperty("/imageStepTitle", "Take Photos");
            this.oModel.setProperty("/imageStepMessage", "Take photos of the carrier Before/After loading.");
            this.oModel.setProperty("/imageType", "B");
            this.oModel.setProperty("/showCarrierLineCombo", true);
            this.oModel.setProperty("/showCarrierTypeCombo", true);
            MessageToast.show("New inspection record. Proceed with Inspection codes.");
        },

        onDocumentDetailsComplete: function () {
            console.log("=== onDocumentDetailsComplete FIRED ===");

            const recordExists = this.oModel.getProperty("/recordExists");
            const docStep = this.byId("DocumentDetailsStep");
            const inspStep = this.byId("InspectionCodesStep");
            const imgStep = this.byId("ImageUploadStep");

            if (recordExists) {
                console.log("BRANCHING: Setting next step to ImageUploadStep");
                docStep.setNextStep(imgStep);
            } else {
                console.log("NORMAL FLOW: Setting next step to InspectionCodesStep");
                docStep.setNextStep(inspStep);
                this._checkDefectModuleLicense();
            }
        },

        // ========================================
        // STEP 2: INSPECTION CODES
        // ========================================

        _checkDefectModuleLicense() {
            if (this.oModel.getProperty("/isAccepted")) {
                // Codes already saved for this record - don't flip the UI under the user
                return;
            }

            console.log("=== Checking DefectModule license (SI_LicenseSet) ===");
            const oModel = this.getOwnerComponent().getModel();
            this.oModel.setProperty("/isCheckingDefectLicense", true);

            ODataService.checkLicenseModule(oModel, "DefectModule")
                .then((bAllowed) => {
                    console.log("DefectModule entitlement:", bAllowed);
                    this.oModel.setProperty("/isCheckingDefectLicense", false);
                    this.oModel.setProperty("/defectModuleEnabled", bAllowed);
                })
                .catch((oError) => {
                    console.error("Defect module license check failed:", oError);
                    this.oModel.setProperty("/isCheckingDefectLicense", false);
                    this.oModel.setProperty("/defectModuleEnabled", false);
                });
        },

        onScanContainer() {
            if (!this.oModel.getProperty("/isAcceptButtonEnabled")) {
                MessageBox.warning("Codes have already been accepted and cannot be changed.");
                return;
            }

            if (this._containerScanDialog) {
                this._containerScanDialog.destroy();
                this._containerScanDialog = null;
            }

            var that = this;
            this._containerScanDialog = new sap.m.Dialog({
                title: "Scan Container",
                contentWidth: "600px",
                contentHeight: "420px",
                content: new sap.m.VBox({
                    items: [
                        new sap.m.VBox({
                            id: "containerScanVideoContainer",
                            width: "100%",
                            height: "400px"
                        })
                    ]
                }),
                beginButton: new sap.m.Button({
                    text: "Capture",
                    type: "Emphasized",
                    press: function () { that.onCaptureContainerImage(); }
                }),
                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function () { that._containerScanDialog.close(); }
                }),
                afterClose: function () {
                    ImageService.cleanupCamera();
                    ImageService.clearCameraContainer("containerScanVideoContainer");
                }
            });

            this.getView().addDependent(this._containerScanDialog);
            this._containerScanDialog.open();

            setTimeout(function () {
                var oContainer = sap.ui.getCore().byId("containerScanVideoContainer");
                if (oContainer && oContainer.getDomRef()) {
                    ImageService.initializeCamera(oContainer.getDomRef())
                        .then(function (videoElement) {
                            that._containerScanVideo = videoElement;
                        })
                        .catch(function (err) {
                            MessageBox.error("Camera error: " + err.message);
                        });
                }
            }, 300);
        },

        onCaptureContainerImage() {
            if (!this._containerScanVideo) {
                MessageBox.error("Camera not ready. Please wait a moment and try again.");
                return;
            }

            const oImage = ImageService.captureImage(this._containerScanVideo, "B");

            // Show full-res image in preview, but resize to max 640px for AI call
            this.oModel.setProperty("/containerImageSrc", oImage.base64);
            this.oModel.setProperty("/showContainerImage", true);
            this.oModel.setProperty("/showDefectSection", false);
            this.oModel.setProperty("/showAcceptRejectButtons", false);
            this.oModel.setProperty("/aiTokenUsage", null);

            this._containerScanDialog.close();

            this._resizeImageForAI(oImage.base64, 640, 0.7, (sResizedDataUrl) => {
                const sBase64 = sResizedDataUrl.split(",")[1];
                this.oModel.setProperty("/containerImageBase64", sBase64);
                this._analyzeContainerImage(sBase64, "image/jpeg");
            });
        },

        _resizeImageForAI(sDataUrl, iMaxWidth, fQuality, fnCallback) {
            var oImg = new window.Image();
            oImg.onload = function () {
                var iW = oImg.width;
                var iH = oImg.height;
                if (iW > iMaxWidth) {
                    iH = Math.round(iH * iMaxWidth / iW);
                    iW = iMaxWidth;
                }
                var oCanvas = document.createElement("canvas");
                oCanvas.width = iW;
                oCanvas.height = iH;
                oCanvas.getContext("2d").drawImage(oImg, 0, 0, iW, iH);
                fnCallback(oCanvas.toDataURL("image/jpeg", fQuality));
            };
            oImg.src = sDataUrl;
        },

        async _analyzeContainerImage(sBase64, sMimeType) {
            this.oModel.setProperty("/isAnalyzing", true);

            try {
                const sRaw = this.getOwnerComponent().getModel("defect").sServiceUrl;
                const sServiceUrl = sRaw.endsWith("/") ? sRaw : sRaw + "/";

                // Fetch CSRF token first, then POST (same pattern as working defectanalysis app)
                const oCsrfRes = await fetch(sServiceUrl, { headers: { "X-CSRF-Token": "Fetch" } });
                const sToken = oCsrfRes.headers.get("x-csrf-token") || "";

                const oResponse = await fetch(sServiceUrl + "analyzeImage", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "X-CSRF-Token": sToken
                    },
                    body: JSON.stringify({ imageData: sBase64, mimeType: sMimeType })
                });

                if (!oResponse.ok) {
                    const sBody = await oResponse.text();
                    throw new Error("HTTP " + oResponse.status + ": " + sBody);
                }

                const oData = await oResponse.json();
                const vResult = (oData.d && oData.d.analyzeImage) != null
                    ? oData.d.analyzeImage
                    : (oData.analyzeImage || oData.value || "");

                // Backend now returns { defects, tokenUsage, __metadata } instead of a plain string
                const sDefectsText = (vResult && typeof vResult === "object")
                    ? String(vResult.defects || "").trim()
                    : String(vResult || "").trim();
                const vTokenUsage = (vResult && typeof vResult === "object") ? vResult.tokenUsage : null;

                this.oModel.setProperty("/aiTokenUsage", vTokenUsage);
                this._populateDefectTokenizer(sDefectsText);
            } catch (e) {
                MessageBox.error("AI Analysis Failed:\n" + e.message);
            } finally {
                this.oModel.setProperty("/isAnalyzing", false);
            }
        },

        _populateDefectTokenizer(sDefectsText) {
            const oTokenizer = this.byId("defectTokenizer");
            oTokenizer.removeAllTokens();

            if (!sDefectsText || sDefectsText.toLowerCase().trim() === "none") {
                this.oModel.setProperty("/showDefectSection", true);
                this.oModel.setProperty("/showAcceptRejectButtons", false);
                MessageToast.show("No defects detected. You can add defects manually.");
                return;
            }

            const aDefects = sDefectsText.split(",").map(d => d.trim()).filter(d => d.length > 0);
            aDefects.forEach(sDefect => {
                oTokenizer.addToken(new sap.m.Token({ text: sDefect, key: sDefect }));
            });

            this.oModel.setProperty("/showDefectSection", true);
            this.oModel.setProperty("/showAcceptRejectButtons", true);
        },

        onAddDefectToken() {
            const sText = (this.oModel.getProperty("/newDefectText") || "").trim();
            if (!sText) {
                MessageToast.show("Please enter a defect name.");
                return;
            }
            const oTokenizer = this.byId("defectTokenizer");
            oTokenizer.addToken(new sap.m.Token({ text: sText, key: sText }));
            this.oModel.setProperty("/newDefectText", "");
            this.oModel.setProperty("/showAcceptRejectButtons", true);
        },

        onDefectTokenDelete(oEvent) {
            const aDeletedTokens = oEvent.getParameter("tokens");
            const oTokenizer = this.byId("defectTokenizer");
            aDeletedTokens.forEach(oToken => {
                oTokenizer.removeToken(oToken);
                oToken.destroy();
            });
            if (oTokenizer.getTokens().length === 0) {
                this.oModel.setProperty("/showAcceptRejectButtons", false);
            }
        },

        _buildSelectedCodesFromTokenizer() {
            const oTokenizer = this.byId("defectTokenizer");
            const aTokens = oTokenizer.getTokens();

            const oCurrentDate = new Date();
            const sDocument = this.oModel.getProperty("/document");
            const sSequence = this.oModel.getProperty("/sequenceNumber");
            const sCarrier = this.oModel.getProperty("/carrierNumber");

            const textToCodeMap = this._getTextToCodeMap();

            return aTokens.map((oToken, index) => ({
                Document: sDocument,
                Sequencenumber: sSequence,
                CarrierNumber: sCarrier,
                InspectionDate: `/Date(${oCurrentDate.getTime()})/`,
                CodeSeq: String(index + 1).padStart(2, "0"),
                CodeValue: textToCodeMap[oToken.getText()] || String(index + 1).padStart(2, "0"),
                CodeText: oToken.getText(),
                CreatedOn: `/Date(${oCurrentDate.getTime()})/`,
                CreatedBy: "USER"
            }));
        },

        onDefectCodeChange(oEvent) {
            const oCheckBox = oEvent.getSource();
            const bSelected = oCheckBox.getSelected();
            const sKey = oCheckBox.data("codeKey");

            // Check if checkboxes are locked (codes already accepted)
            const areCheckboxesEnabled = this.oModel.getProperty("/areCheckboxesEnabled");
            if (!areCheckboxesEnabled) {
                // Revert the checkbox to its previous state
                oCheckBox.setSelected(!bSelected);
                MessageBox.warning("Codes have been accepted and cannot be modified.");
                return;
            }

            console.log(`Checkbox changed: ${sKey} = ${bSelected}`);

            const oDefectCodes = this.oModel.getProperty("/defectCodes");
            oDefectCodes[sKey] = bSelected;
            this.oModel.setProperty("/defectCodes", oDefectCodes);

            let bAnySelected = ValidationService.validateDefectCodes(oDefectCodes);
            this.oModel.setProperty("/showAcceptRejectButtons", bAnySelected);

            console.log("Any selected:", bAnySelected);
        },

        _getCurrentSelectedCodeTexts() {
            if (this.oModel.getProperty("/defectModuleEnabled")) {
                const oTokenizer = this.byId("defectTokenizer");
                return oTokenizer ? oTokenizer.getTokens().map(t => t.getText()) : [];
            }
            const oDefectCodes = this.oModel.getProperty("/defectCodes");
            return Object.keys(oDefectCodes).filter(key => oDefectCodes[key]);
        },

        onAcceptCodes() {
            const aCurrentSelectedCodes = this._getCurrentSelectedCodeTexts();
            const aSavedCodes = this.oModel.getProperty("/savedCodes") || [];

            if (ValidationService.areCodesSaved(aCurrentSelectedCodes, aSavedCodes)) {
                MessageBox.information("CODES ALREADY SAVED");
                return;
            }

            this._saveInspectionCodes('A', (success) => {
                if (success) {
                    this._wizard.validateStep(this.byId("InspectionCodesStep"));
                    this.oModel.setProperty("/isAccepted", true);
                    this.oModel.setProperty("/isRejectEnabled", false);
                    // Store the saved codes
                    this.oModel.setProperty("/savedCodes", aCurrentSelectedCodes);
                    // Disable Accept button and checkboxes/tokenizer after accepting
                    this.oModel.setProperty("/isAcceptButtonEnabled", false);
                    this.oModel.setProperty("/areCheckboxesEnabled", false);
                    this.oModel.setProperty("/isTokenizerEditable", false);
                    MessageToast.show("Inspection Code saved successfully! Click Step 3 to upload photos.");
                }
            });
        },

        onRejectCodes() {
            // Get current selected codes before saving
            const aCurrentSelectedCodes = this._getCurrentSelectedCodeTexts();

            this._saveInspectionCodes('R', (success) => {
                if (success) {
                    // Mark carrier as rejected and navigate to photo capture
                    this.oModel.setProperty("/isRejected", true);
                    this.oModel.setProperty("/imageType", "B");

                    // Store the saved codes (so step 2 re-validates when returning)
                    this.oModel.setProperty("/savedCodes", aCurrentSelectedCodes);
                    this.oModel.setProperty("/isAccepted", true); // Set to true so validation logic works

                    // Disable Accept and Reject buttons after rejecting
                    this.oModel.setProperty("/isAcceptButtonEnabled", false);
                    this.oModel.setProperty("/isRejectEnabled", false);
                    this.oModel.setProperty("/areCheckboxesEnabled", false);
                    this.oModel.setProperty("/isTokenizerEditable", false);

                    // Validate Step 2 so we can proceed to Step 3
                    this._wizard.validateStep(this.byId("InspectionCodesStep"));

                    // Show toast message - user will manually click Step 3 to proceed
                    MessageToast.show("Defect codes rejected and saved. Click Step 3 to take before-loading photos only.");
                }
            });
        },

        onBackToStep1() {
            // Navigate to Step 1 without invalidating Step 2
            // This allows users to go back and then return to Step 2
            // If codes were already accepted, Step 3 will still be accessible

            const that = this;

            // Navigate back first
            this._wizard.previousStep();

            // Then reset progress bar AFTER navigation with a small delay
            setTimeout(function () {
                const oStep1 = that.byId("DocumentDetailsStep");
                const inspStep = that.byId("InspectionCodesStep");
                const imgStep = that.byId("ImageUploadStep");

                if (oStep1 && inspStep && imgStep) {
                    try {
                        // Reset nextStep to default
                        oStep1.setNextStep(inspStep);

                        // Also set subsequentSteps to ensure progress bar shows all 3 steps
                        if (typeof oStep1.setSubsequentSteps === 'function') {
                            oStep1.setSubsequentSteps([inspStep, imgStep]);
                        }

                        console.log("Progress bar reset after going back to Step 1");
                    } catch (e) {
                        console.error("Error resetting progress bar:", e);
                    }
                }
            }, 100);
        },

        _saveInspectionCodes(sStatus, callback) {
            console.log(`=== SAVING CODES (Status: ${sStatus}) ===`);

            const bDefectModuleEnabled = this.oModel.getProperty("/defectModuleEnabled");
            const aSelectedCodes = bDefectModuleEnabled
                ? this._buildSelectedCodesFromTokenizer()
                : this._buildSelectedCodes(this.oModel.getProperty("/defectCodes"));

            if (aSelectedCodes.length === 0) {
                if (sStatus === 'R') {
                    MessageBox.warning("No defect codes selected to reject.", {
                        onClose: () => {
                            this._wizard.previousStep();
                        }
                    });
                } else {
                    MessageBox.error("Please select at least one defect code to proceed.");
                }
                if (callback) callback(false);
                return;
            }

            const oDeepEntityData = this._createDeepEntityPayload(aSelectedCodes, sStatus);
            const oModel = this.getOwnerComponent().getModel();

            ODataService.saveInspectionCodes(oModel, oDeepEntityData)
                .then(() => {
                    if (callback) callback(true);
                })
                .catch((oError) => {
                    const sErrorMessage = this._parseErrorMessage(oError) || "Failed to save codes";
                    MessageBox.error("Save Failed:\n" + sErrorMessage);
                    if (callback) callback(false);
                });
        },

        // ========================================
        // STEP 3: IMAGE UPLOAD
        // ========================================

        onOpenCameraDialog() {
            var that = this;

            // Always recreate the dialog for image capture to avoid conflicts with container scan dialog
            if (this._cameraDialog) {
                this._cameraDialog.destroy();
                this._cameraDialog = null;
            }

            this._cameraDialog = new sap.m.Dialog({
                title: "Camera Preview",
                contentWidth: "600px",
                contentHeight: "420px",
                content: new sap.m.VBox({
                    items: [
                        new sap.m.VBox({
                            id: "cameraVideoContainer",
                            width: "100%",
                            height: "400px"
                        })
                    ]
                }),
                beginButton: new sap.m.Button({
                    text: "Capture",
                    type: "Emphasized",
                    press: function () { that.onCapture(); }  // ← This is the key fix
                }),
                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function () {
                        that.onCloseCameraDialog();
                    }
                }),
                afterClose: function () {
                    that._cleanupCamera();
                }
            });
            this.getView().addDependent(this._cameraDialog);

            this._cameraDialog.open();

            setTimeout(function () {
                var oContainer = sap.ui.getCore().byId("cameraVideoContainer");
                if (oContainer && oContainer.getDomRef()) {
                    var containerDom = oContainer.getDomRef();

                    ImageService.initializeCamera(containerDom)
                        .then(function (video) {
                            that._stream = ImageService._stream;
                            that._videoElement = video;
                        })
                        .catch(function (err) {
                            console.error("Camera initialization failed:", err);
                        });
                }
            }, 300);
        },

        onCapture() {
            console.log("=== CAPTURE BUTTON CLICKED ===");

            var video = this._videoElement;
            if (!video) {
                MessageToast.show("Video not ready!");
                return;
            }

            const imageType = this.oModel.getProperty("/currentImageType");
            const oImageData = ImageService.captureImage(video, imageType);

            if (imageType === "B") {
                const aBeforeImages = this.oModel.getProperty("/beforeImages") || [];
                aBeforeImages.push(oImageData);
                this.oModel.setProperty("/beforeImages", aBeforeImages);
                this.oModel.setProperty("/beforeImageCount", aBeforeImages.length);
                MessageToast.show(`Before loading image ${aBeforeImages.length} captured`);
            } else {
                const aAfterImages = this.oModel.getProperty("/afterImages") || [];
                aAfterImages.push(oImageData);
                this.oModel.setProperty("/afterImages", aAfterImages);
                this.oModel.setProperty("/afterImageCount", aAfterImages.length);
                MessageToast.show(`After loading image ${aAfterImages.length} captured`);
            }

            const oStep3 = this.byId("ImageUploadStep");
            if (oStep3) {
                oStep3.setValidated(true);
                console.log("Step 3 validated - Complete Inspection button should appear");
            }

            this._cameraDialog.close();
            console.log("Image saved directly to gallery");
        },

        onCloseCameraDialog() {
            if (this._cameraDialog) {
                this._cameraDialog.close();
            }
            this._cleanupCamera();
            this.oModel.setProperty("/cameraActive", true);
            this.oModel.setProperty("/imageCapured", false);
        },

        onTakeBeforePhoto() {
            const count = this.oModel.getProperty("/beforeImageCount");
            if (!ValidationService.validateImageCount(count, 6)) {
                MessageBox.warning("Maximum 6 before-loading images allowed. You have already taken " + count + " images.");
                return;
            }
            this.oModel.setProperty("/currentImageType", "B");
            this.onOpenCameraDialog();
        },

        onTakeAfterPhoto() {
            const isRejected = this.oModel.getProperty("/isRejected");
            const recordStatus = this.oModel.getProperty("/recordStatus");

            if (isRejected || recordStatus === 'R') {
                MessageBox.warning("This carrier was rejected. Only before-loading photos are allowed for rejected carriers.");
                return;
            }

            const count = this.oModel.getProperty("/afterImageCount");
            if (!ValidationService.validateImageCount(count, 6)) {
                MessageBox.warning("Maximum 6 after-loading images allowed. You have already taken " + count + " images.");
                return;
            }
            this.oModel.setProperty("/currentImageType", "A");
            this.onOpenCameraDialog();
        },

        onDeleteBeforeImage(oEvent) {
            const oListItem = oEvent.getParameter("listItem");
            const oContext = oListItem.getBindingContext();
            const sPath = oContext.getPath();
            const iIndex = parseInt(sPath.split("/").pop());

            const aBeforeImages = this.oModel.getProperty("/beforeImages");
            const updatedImages = ImageService.deleteImage(aBeforeImages, iIndex);

            this.oModel.setProperty("/beforeImages", updatedImages);
            this.oModel.setProperty("/beforeImageCount", updatedImages.length);

            MessageToast.show("Before image deleted");
        },

        onDeleteAfterImage(oEvent) {
            const oListItem = oEvent.getParameter("listItem");
            const oContext = oListItem.getBindingContext();
            const sPath = oContext.getPath();
            const iIndex = parseInt(sPath.split("/").pop());

            const aAfterImages = this.oModel.getProperty("/afterImages");
            const updatedImages = ImageService.deleteImage(aAfterImages, iIndex);

            this.oModel.setProperty("/afterImages", updatedImages);
            this.oModel.setProperty("/afterImageCount", updatedImages.length);

            MessageToast.show("After image deleted");
        },

        // ========================================
        // PDF GENERATION & UPLOAD
        // ========================================

        onSaveAllImagesToPDF: async function () {
            console.log("=== SAVE TO ATTACHMENTS CLICKED ===");

            const beforeCount = this.oModel.getProperty("/beforeImageCount");
            const afterCount = this.oModel.getProperty("/afterImageCount");

            let imageType = "";
            let aImages = [];

            if (beforeCount > 0 && afterCount === 0) {
                imageType = "B";
                aImages = this.oModel.getProperty("/beforeImages");
            } else if (afterCount > 0 && beforeCount === 0) {
                imageType = "A";
                aImages = this.oModel.getProperty("/afterImages");
            } else if (beforeCount > 0 && afterCount > 0) {
                MessageBox.error("Invalid state: Cannot have both before and after images at the same time.");
                return;
            } else {
                MessageBox.warning("No images to save");
                return;
            }

            if (aImages.length === 0) {
                MessageBox.warning("No images found");
                return;
            }

            sap.ui.core.BusyIndicator.show(0);

            try {
                await this._loadPdfMake();
                console.log("pdfMake loaded");
                const inspectionData = await this._fetchInspectionData();
                const oHeaderData = {
                    document: this.oModel.getProperty("/document"),
                    sequence: this.oModel.getProperty("/sequenceNumber"),
                    carrier: this.oModel.getProperty("/carrierNumber"),
                    carrierLineCode: this.oModel.getProperty("/carrierLine"),
                    carrierTypeCode: this.oModel.getProperty("/carrierType")
                };

                const sCurrentUser = this._getCurrentUser();
                console.log("sCurrentUser", sCurrentUser);
                const docDefinition = PDFService.createPDFDefinition(
                    imageType,
                    aImages,
                    inspectionData,
                    oHeaderData,
                    this._getCarrierLineDescription.bind(this),
                    this._getCarrierTypeDescription.bind(this),
                    sCurrentUser
                );
                console.log("=== PDF DEBUG LOGGING ===");
                console.log("PDF pageSize:", docDefinition.pageSize);
                console.log("PDF pageOrientation:", docDefinition.pageOrientation);
                console.log("PDF pageMargins:", docDefinition.pageMargins);
                console.log("Images count:", aImages.length);
                console.log("Device pixel ratio:", window.devicePixelRatio);
                console.log("User agent:", navigator.userAgent);
                console.log("First image block:", docDefinition.content[docDefinition.content.length - 1]);
                // console.log("Content length before images:", docDefinition.content.length - imageContent.length);

                const pdfBase64 = await PDFService.generatePDF(docDefinition);
                const pdfBlob = PDFService.base64ToBlob(pdfBase64);
                const slug = PDFService.generateSlug(oHeaderData.document, oHeaderData.carrier, imageType);

                console.log("Upload SLUG:", slug);




                await this._uploadPDFToBackend(pdfBlob, slug, imageType, aImages.length);

            } catch (e) {
                console.error("PDF generation or upload failed:", e);
                MessageBox.error("Failed to save images as PDF: " + e.message);
                sap.ui.core.BusyIndicator.hide();
            }
        },

        _fetchInspectionData() {
            const aFilters = this._createHeaderFilters();
            const oModel = this.getOwnerComponent().getModel();
            return ODataService.fetchInspectionData(oModel, aFilters);
        },


        _getCurrentUser() {
            const oModel = this.getOwnerComponent().getModel();
            return UserHelper.getCurrentUser(oModel);
        },

        _uploadPDFToBackend(pdfBlob, slug, imageType, imageCount) {
            const that = this;
            const oModel = this.getOwnerComponent().getModel();

            return ODataService.uploadPDF(oModel, pdfBlob, slug)
                .then(() => {
                    if (imageType === "B") {
                        that.oModel.setProperty("/beforeImages", []);
                        that.oModel.setProperty("/beforeImageCount", 0);
                    } else {
                        that.oModel.setProperty("/afterImages", []);
                        that.oModel.setProperty("/afterImageCount", 0);
                    }

                    that.oModel.refresh(true);
                    that._updateHeaderFlagsAfterUpload(imageType);

                    console.log(`${imageCount} ${imageType === 'B' ? 'before' : 'after'} loading images saved successfully`);
                });
        },

        _updateHeaderFlagsAfterUpload(imageType) {
            const aFilters = this._createHeaderFilters();
            const oModel = this.getOwnerComponent().getModel();

            ODataService.updateHeaderFlags(oModel, aFilters, imageType)
                .then((oRecord) => {
                    ODataService.updateUsage(
                        oModel,
                        oRecord.Document,
                        oRecord.Sequencenumber,
                        oRecord.CarrierNumber,
                        oRecord.InspectionDate
                    ).then((sWarning) => {
                        if (sWarning) {
                            MessageBox.warning(sWarning);
                        }
                    }).catch((oError) => {
                        MessageBox.error(this._parseErrorMessage(oError));
                    });
                })
                .catch(() => {
                    MessageBox.error("Failed to update inspection flags");
                });
        },

        // ========================================
        // FINISH INSPECTION
        // ========================================

        onFinishInspection: async function () {
            console.log("=== FINISH INSPECTION CLICKED ===");

            const beforeCount = this.oModel.getProperty("/beforeImageCount");
            const afterCount = this.oModel.getProperty("/afterImageCount");

            // Check if at least one image is taken
            if (beforeCount === 0 && afterCount === 0) {
                MessageBox.warning("Please take at least 1 image to complete the inspection.");
                return;
            }

            if (beforeCount > 0 || afterCount > 0) {
                try {
                    sap.ui.core.BusyIndicator.show(0);
                    await this.onSaveAllImagesToPDF();
                    sap.ui.core.BusyIndicator.hide();
                    this._showCompletionDialog();
                } catch (error) {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Error saving images:", error);
                    MessageBox.error("Failed to save images: " + error.message);
                }
            }
        },

        _showCompletionDialog: function () {
            // Reset progress bar to show all 3 steps before showing completion dialog
            this._resetProgressBarToFullView();

            MessageBox.confirm(
                "Inspection completed successfully! Do you want to start a new inspection?",
                {
                    title: "Inspection Complete",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.YES) {
                            this._resetWizard();
                        }
                    }
                }
            );
        },

        _resetProgressBarToFullView: function () {
            console.log("=== RESETTING PROGRESS BAR TO FULL VIEW ===");

            try {
                const oStep1 = this.byId("DocumentDetailsStep");
                const inspStep = this.byId("InspectionCodesStep");
                const imgStep = this.byId("ImageUploadStep");

                if (!oStep1 || !inspStep || !imgStep) {
                    console.error("One or more wizard steps not found");
                    return;
                }

                // For existing records, reset the nextStep back to InspectionCodesStep
                // This will restore the full 3-step progress bar
                oStep1.setNextStep(inspStep);

                // Also set subsequentSteps to ensure progress bar shows all 3 steps
                if (typeof oStep1.setSubsequentSteps === 'function') {
                    oStep1.setSubsequentSteps([inspStep, imgStep]);
                }

                console.log("Progress bar reset: DocumentDetailsStep -> InspectionCodesStep -> ImageUploadStep");

            } catch (e) {
                console.error("Error resetting progress bar:", e.message);
            }
        },

        // ========================================
        // WIZARD CONTROL
        // ========================================

        onCompleteInspection() {
            MessageToast.show("Inspection completed successfully!");
            this._showSuccessPage();
        },

        _showSuccessPage() {
            this._oNavContainer.to(this.byId("successPage"));
        },

        onNewInspection() {
            MessageBox.confirm(
                "Carrier Data Saved Successfully.",
                {
                    title: "Confirm New Inspection",
                    actions: [MessageBox.Action.OK],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            this._resetWizard();
                        }
                    }
                }
            );
        },

        onWizardCancel() {
            this._resetWizard();
        },

        _resetWizard() {
            this._clearInputFields();

            const oDefectCodes = this.oModel.getProperty("/defectCodes");
            const resetCodes = InspectionCodeService.resetDefectCodes(oDefectCodes);
            this.oModel.setProperty("/defectCodes", resetCodes);
            this._uncheckAllCheckboxes();

            this.oModel.setProperty("/beforeImages", []);
            this.oModel.setProperty("/afterImages", []);
            this.oModel.setProperty("/beforeImageCount", 0);
            this.oModel.setProperty("/afterImageCount", 0);
            this.oModel.setProperty("/currentImageType", "B");

            this.capturedImageData = null;
            this.oModel.refresh(true);

            this.oModel.setProperty("/showAcceptRejectButtons", false);
            this.oModel.setProperty("/isRejectEnabled", true);
            this.oModel.setProperty("/isAccepted", false);
            this.oModel.setProperty("/savedCodes", []);
            this.oModel.setProperty("/isAcceptButtonEnabled", true);
            this.oModel.setProperty("/areCheckboxesEnabled", true);

            // Clear Step 2 container scan & defect data
            this.oModel.setProperty("/containerImageSrc", "");
            this.oModel.setProperty("/containerImageBase64", "");
            this.oModel.setProperty("/showContainerImage", false);
            this.oModel.setProperty("/showDefectSection", false);
            this.oModel.setProperty("/newDefectText", "");
            this.oModel.setProperty("/isTokenizerEditable", true);
            this.oModel.setProperty("/aiTokenUsage", null);
            const oTokenizer = this.byId("defectTokenizer");
            if (oTokenizer) oTokenizer.removeAllTokens();

            this._resetFlags();

            const oStep1 = this.byId("DocumentDetailsStep");
            const oStep2 = this.byId("InspectionCodesStep");
            const oStep3 = this.byId("ImageUploadStep");

            if (oStep1) oStep1.setValidated(false);
            if (oStep2) oStep2.setValidated(false);
            if (oStep3) oStep3.setValidated(false);

            this._wizard.setCurrentStep(oStep1);

            setTimeout(() => {
                this._wizard.goToStep(oStep1, true);
                console.log("Navigated to Step 1");
            }, 100);

            this._oNavContainer.backToPage(this.byId("wizardContentPage"));
        },

        _uncheckAllCheckboxes() {
            const oVBox1 = this.byId("_IDGenVBox1");
            const oVBox2 = this.byId("_IDGenVBox2");

            if (oVBox1) {
                const aItems1 = oVBox1.getItems();
                aItems1.forEach(oCheckbox => {
                    if (oCheckbox.setSelected) {
                        oCheckbox.setSelected(false);
                    }
                });
            }

            if (oVBox2) {
                const aItems2 = oVBox2.getItems();
                aItems2.forEach(oCheckbox => {
                    if (oCheckbox.setSelected) {
                        oCheckbox.setSelected(false);
                    }
                });
            }
        },

        wizardCompletedHandler() {
            MessageToast.show("All steps completed!");
        },

        onWizardStepActivate(oEvent) {
            console.log("=== Wizard Step Activated ===");

            const oStep = oEvent.getParameter("step");
            if (!oStep) return;

            const sStepId = oStep.getId();

            // Always maintain the default subsequent steps to keep progress bar as 1→2→3
            if (sStepId && sStepId.includes("DocumentDetailsStep")) {
                const oStep1 = this.byId("DocumentDetailsStep");
                const inspStep = this.byId("InspectionCodesStep");
                const imgStep = this.byId("ImageUploadStep");
                if (oStep1 && inspStep && imgStep) {
                    try {
                        if (typeof oStep1.setSubsequentSteps === 'function') {
                            oStep1.setSubsequentSteps([inspStep, imgStep]);
                        }
                        console.log("Step 1 subsequentSteps maintained as [InspectionCodesStep, ImageUploadStep]");
                    } catch (e) {
                        console.error("Error setting subsequent steps:", e);
                    }
                }
            }

            if (sStepId && sStepId.includes("ImageUploadStep")) {
                // Reset progress bar to show all 3 steps when on ImageUploadStep
                const oStep1 = this.byId("DocumentDetailsStep");
                const inspStep = this.byId("InspectionCodesStep");
                const imgStep = this.byId("ImageUploadStep");
                if (oStep1 && inspStep && imgStep) {
                    try {
                        if (typeof oStep1.setSubsequentSteps === 'function') {
                            oStep1.setSubsequentSteps([inspStep, imgStep]);
                        }
                        console.log("Progress bar reset to show all 3 steps when on ImageUploadStep");
                    } catch (e) {
                        console.error("Error resetting progress bar:", e);
                    }
                }

                setTimeout(() => {
                    this._setImageButtonStates();
                }, 100);
            }

            if (sStepId && sStepId.includes("InspectionCodesStep")) {
                const codes = this.oModel.getProperty("/inspectionCodes");
                if (!codes || codes.length === 0) {
                    console.warn("No inspection codes loaded, reloading...");
                    this._loadInspectionCodes();
                }

                this._checkDefectModuleLicense();

                // Re-validate step if codes were already accepted
                const isAccepted = this.oModel.getProperty("/isAccepted");
                const aSavedCodes = this.oModel.getProperty("/savedCodes") || [];
                if (isAccepted && aSavedCodes.length > 0) {
                    const oStep2 = this.byId("InspectionCodesStep");
                    if (oStep2 && !oStep2.getValidated()) {
                        oStep2.setValidated(true);
                        console.log("Step 2 re-validated because codes were already accepted");
                    }
                }
            }
        },

        onStepActivate: function (oEvent) {
            var that = this;
            setTimeout(function () {
                that.disablePreviousSteps();
            }, 500);

            // Re-validate Step 2 if codes were already accepted
            const oStep = oEvent.getParameter && oEvent.getParameter("step");
            if (oStep && oStep.getId && oStep.getId().includes("InspectionCodesStep")) {
                const isAccepted = this.oModel.getProperty("/isAccepted");
                const aSavedCodes = this.oModel.getProperty("/savedCodes") || [];
                if (isAccepted && aSavedCodes.length > 0) {
                    const oStep2 = this.byId("InspectionCodesStep");
                    if (oStep2 && !oStep2.getValidated()) {
                        setTimeout(() => {
                            oStep2.setValidated(true);
                            this._wizard.validateStep(oStep2);
                            console.log("Step 2 re-validated in onStepActivate");
                        }, 100);
                    }
                }
            }
        },

        disablePreviousSteps: function () {
            var currentStep = this._wizard.getProgressStep();
            var allSteps = this._wizard.getSteps();
            var currentIndex = allSteps.indexOf(currentStep);

            // Re-validate Step 2 if it's the current step and codes were already accepted
            if (currentStep && currentStep.getId && currentStep.getId().includes("InspectionCodesStep")) {
                const isAccepted = this.oModel.getProperty("/isAccepted");
                const aSavedCodes = this.oModel.getProperty("/savedCodes") || [];
                if (isAccepted && aSavedCodes.length > 0) {
                    const oStep2 = this.byId("InspectionCodesStep");
                    if (oStep2 && !oStep2.getValidated()) {
                        oStep2.setValidated(true);
                        this._wizard.validateStep(oStep2);
                        console.log("Step 2 re-validated in disablePreviousSteps");
                    }
                }
            }

            // Use CSS to disable previous steps in progress navigator
            setTimeout(function () {
                var progressNavItems = document.querySelectorAll(".sapMWizardProgressNavStep");
                for (var i = 0; i < currentIndex; i++) {
                    if (progressNavItems[i]) {
                        progressNavItems[i].style.pointerEvents = "none";
                        progressNavItems[i].style.opacity = "0.5";
                    }
                }
            }, 100);
        },
        onCopyCarrier: function () {
            const oInput = this.byId("carrierInput");
            const value = oInput.getValue();

            if (!value) {
                console.warn("No carrier number to copy.");
                return;
            }

            navigator.clipboard.writeText(value)
                .then(() => console.log("Copied:", value))
                .catch(err => console.error("Copy failed:", err));
        },


        _setImageButtonStates() {
            const hasBeforeImg = this.oModel.getProperty("/hasBeforeImg");
            const isRejected = this.oModel.getProperty("/isRejected");
            const recordStatus = this.oModel.getProperty("/recordStatus");
            const btnBefore = this.byId("btnBeforePhoto");
            const btnAfter = this.byId("btnAfterPhoto");

            if (!btnBefore || !btnAfter) return;

            // For rejected carriers, disable after photos button
            if (isRejected || recordStatus === 'R') {
                btnBefore.setEnabled(true);
                btnAfter.setEnabled(false);
                console.log("After photos button disabled - carrier is rejected");
                return;
            }

            if (hasBeforeImg === 'X' || hasBeforeImg === true) {
                btnBefore.setEnabled(false);
                btnAfter.setEnabled(true);
            } else {
                btnBefore.setEnabled(true);
                btnAfter.setEnabled(false);
            }
        },
        onContainerScan() {

            var that = this;

            // Destroy any existing camera dialog to avoid conflicts
            if (this._cameraDialog) {
                this._cameraDialog.destroy();
                this._cameraDialog = null;
            }
            this._cameraDialog = new sap.m.Dialog({
                title: "Camera Preview",
                draggable: true,
                contentWidth: "600px",
                contentHeight: "420px",
                content: new sap.m.VBox({
                    items: [
                        new sap.m.VBox({
                            id: "cameraVideoContainer",
                            width: "100%",
                            height: "400px"
                        })
                    ]
                }),

                
                beginButton: new sap.m.Button({
                    text: "Capture",
                    type: "Emphasized",
                    press: function () { that.onCaptureCarrierNo(); }
                }),
                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function () {
                        that.onCloseCameraDialog();
                    }
                }),
                afterClose: function () {
                    that._cleanupCamera();
                }
            });
            this.getView().addDependent(this._cameraDialog);


            this._cameraDialog.open();

            setTimeout(function () {
                var oContainer = sap.ui.getCore().byId("cameraVideoContainer");
                if (oContainer && oContainer.getDomRef()) {
                    var containerDom = oContainer.getDomRef();

                    ImageService.initializeCamera(containerDom)
                        .then(function (video) {
                            that._stream = ImageService._stream;
                            that._videoElement = video;
                        })
                        .catch(function (err) {
                            console.error("Camera initialization failed:", err);
                        });
                }
            }, 300);
        },

        onCaptureCarrierNo: function () {
            const oModel = this.getOwnerComponent().getModel();
            sap.ui.core.BusyIndicator.show(0);

            ODataService.checkLicenseModule(oModel, "OcrModule")
                .then((bAllowed) => {
                    sap.ui.core.BusyIndicator.hide();

                    if (!bAllowed) {
                        if (this._cameraDialog) {
                            this._cameraDialog.close();
                        }
                        MessageBox.error("Your organization has not subscribed to the OCR module. Please contact your administrator to upgrade your license.");
                        return;
                    }

                    this._scanAndDetectContainer();
                })
                .catch((oError) => {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("License check failed:", oError);
                    MessageBox.error("Unable to verify your license. Please try again.");
                });
        },

        _scanAndDetectContainer: function () {

            const video = this._videoElement;
            if (!video) {
                MessageToast.show("Video not ready!");
                return;
            }

            // Scale down to max 800px wide to keep payload under CAP service 1MB limit
            const MAX_WIDTH = 800;
            const srcW = video.videoWidth || 640;
            const srcH = video.videoHeight || 480;
            const scale = srcW > MAX_WIDTH ? MAX_WIDTH / srcW : 1;

            const canvas = document.createElement("canvas");
            canvas.width = Math.round(srcW * scale);
            canvas.height = Math.round(srcH * scale);
            canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);

            const base64Image = canvas.toDataURL("image/jpeg", 0.7);

            this._cameraDialog.close();
            sap.ui.core.BusyIndicator.show(0);

            const oCropModel = this.getOwnerComponent().getModel("catalog");

            /* ================= STEP 1: CROP ================= */

            oCropModel.create("/detectContainer", {
                image: base64Image
            }, {
                success: function (oData) {

                    console.log("Crop response:", oData);

                    const croppedImage =
                        oData.value ||
                        oData.detectContainer ||
                        oData.d?.value;

                    if (!croppedImage) {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show("No container detected");
                        return;
                    }

                    this._showCropPreview(croppedImage);

                    /* ================= STEP 2: OCR ================= */

                    const oOcrModel = this.getOwnerComponent().getModel("ocr");

                    oOcrModel.create("/extractText", {
                        image: croppedImage
                    }, {
                        success: function (ocrData) {

                            sap.ui.core.BusyIndicator.hide();

                            console.log("OCR response:", ocrData);

                            // extractText now returns a structured ContainerResult
                            // ({ ownerCode, serialNumber, checkDigit, containerNumber }) -
                            // the backend already validated/reconstructed it (throws 422 via
                            // the error callback if owner code/serial couldn't be read), so
                            // just read containerNumber straight through, no re-validation.
                            const oResult = ocrData.extractText ?? ocrData.d?.extractText ?? ocrData ?? {};
                            const finalNumber = (oResult.containerNumber || "").toString().replace(/\s+/g, "");

                            if (!finalNumber) {
                                MessageToast.show("Could not read a container number — please scan again");
                                return;
                            }

                            console.log("✅ Final container:", finalNumber, "(owner:", oResult.ownerCode, "serial:", oResult.serialNumber, "check:", oResult.checkDigit, ")");

                            this.byId("carrierInput").setValue(finalNumber);
                            this.oModel.setProperty("/carrierNumber", finalNumber);
                            this.onDocumentDetailsChange();

                            MessageToast.show("Container detected: " + finalNumber);

                        }.bind(this),

                        error: function (err) {
                            sap.ui.core.BusyIndicator.hide();
                            console.error("OCR failed:", err);
                            console.error("OCR failed - responseText:", err.responseText);
                            const sStatusPrefix = err.statusCode ? `${err.statusCode}: ` : "";
                            MessageToast.show(sStatusPrefix + (this._parseErrorMessage(err) || "OCR service failed"));
                        }.bind(this)
                    });

                }.bind(this),

                error: function (err) {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Crop failed:", err);
                    const sStatusPrefix = err.statusCode ? `${err.statusCode}: ` : "";
                    MessageToast.show(sStatusPrefix + (this._parseErrorMessage(err) || "Crop service failed"));
                }.bind(this)
            });
        },

        onViewFullImage: function (oEvent) {
            // The thumbnail Image control
            const oImage = oEvent.getSource();

            // Base64 + metadata from the model
            const oCtx = oImage.getBindingContext();
            const oData = oCtx ? oCtx.getObject() : null;

            // DOM image element
            const oDomRef = oImage.getDomRef();
            if (!oDomRef) {
                console.log("onViewFullImage: no DOM ref for image");
                return;
            }

            // 1) Actual rendered size of the thumbnail in the list
            const renderedWidth = oDomRef.clientWidth;
            const renderedHeight = oDomRef.clientHeight;

            // 2) Intrinsic (natural) size of the loaded image
            const naturalWidth = oDomRef.naturalWidth;
            const naturalHeight = oDomRef.naturalHeight;

            console.log("=== onViewFullImage DEBUG ===");
            console.log("Image ID:", oData && oData.id);
            console.log("Thumbnail rendered size (CSS):", renderedWidth + " x " + renderedHeight);
            console.log("Image natural size (pixels):", naturalWidth + " x " + naturalHeight);

            // 3) Optional: log the size that is used when generating the PDF
            //    This matches your capture logic in ImageService.captureImage
            const tempImg = new Image();
            tempImg.onload = () => {
                const pdfCanvasWidth = tempImg.width;
                const pdfCanvasHeight = tempImg.height;
                console.log("PDF capture canvas size (video frame):",
                    pdfCanvasWidth + " x " + pdfCanvasHeight);
            };
            tempImg.src = oData && oData.base64;

            // Here you can also open a dialog to show the full image if you like.
        },

        _showCropPreview: function (base64) {
            const dialog = new sap.m.Dialog({
                title: "Cropped Container",
                content: new sap.m.Image({ src: base64, width: "100%" }),
                beginButton: new sap.m.Button({
                    text: "OK",
                    press: function () { dialog.close(); }
                }),
                afterClose: function () { dialog.destroy(); }
            });
            this.getView().addDependent(dialog);
            dialog.open();
        },

    });
});