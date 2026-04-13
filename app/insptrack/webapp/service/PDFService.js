sap.ui.define([
    "insptrack/lib/pdfMakeLoader"
], (pdfMakeLoader) => {
    "use strict";

    return {
        /**
         * Load pdfMake library
         * @returns {Promise} Promise resolving when library is loaded
         */
        async loadPdfMake() {
            try {
                await pdfMakeLoader.load();
                console.log("pdfMake loaded successfully via UI5 module");
            } catch (error) {
                console.error("Failed to load pdfMake:", error);
                throw new Error("Failed to load PDF library: " + error.message);
            }
        },

        /**
         * Create PDF definition structure
         * @param {string} sType - Image type (B/A)
         * @param {array} aImages - Array of images
         * @param {object} inspectionData - Inspection data with codes and status
         * @param {object} oHeaderData - Header data (document, sequence, carrier, etc.)
         * @param {function} fnGetCarrierLineDesc - Function to get carrier line description
         * @param {function} fnGetCarrierTypeDesc - Function to get carrier type description
         * @param {string} sCurrentUser - Current user name
         * @returns {object} PDF definition object
         */
        createPDFDefinition(sType, aImages, inspectionData, oHeaderData, fnGetCarrierLineDesc, fnGetCarrierTypeDesc, sCurrentUser) {
            const { document, sequence, carrier, carrierLineCode, carrierTypeCode } = oHeaderData;
            const carrierLineDescription = fnGetCarrierLineDesc(carrierLineCode);
            const carrierTypeDescription = fnGetCarrierTypeDesc(carrierTypeCode);

            const sStatus = inspectionData?.status || "";
            const aInspectionCodes = inspectionData?.codes || [];
            const sStatusText = sStatus === 'A' ? 'ACCEPTED' : sStatus === 'R' ? 'REJECTED' : 'PENDING';

            const imageContent = [];

            aImages.forEach((oImage, index) => {
                if (index > 0) {
                    imageContent.push({ text: '', pageBreak: 'before' });
                }

                imageContent.push({
                    text: `${sType === 'B' ? 'Before' : 'After'} Loading - Image ${index + 1}/${aImages.length}`,
                    style: 'imageHeader',
                    margin: [0, 0, 0, 10]
                });

                imageContent.push({
                    text: `Captured: ${new Date(oImage.timestamp).toLocaleString()}`,
                    style: 'timestamp',
                    margin: [0, 0, 0, 15]
                });

                imageContent.push({
                    table: {
                        widths: ['*'],
                        body: [[{
                            image: oImage.base64,
                            fit: [700, 400],
                            alignment: 'center'
                        }]]
                    },
                    layout: 'noBorders',
                    margin: [0, 0, 0, 10]
                });

            });

            const metadataTableBody = [
                ['Document:', document],
                ['Sequence:', sequence],
                ['Carrier Number:', carrier],
                ['Carrier Line:', carrierLineDescription],
                ['Carrier Type:', carrierTypeDescription],
                ['Inspection Status:', { text: sStatusText, bold: true, color: sStatus === 'A' ? '#00AA00' : sStatus === 'R' ? '#CC0000' : '#666666' }],
                ['Inspection Date:', new Date().toLocaleString()],
                ['Total Images:', aImages.length.toString()],
                ['Inspector:', sCurrentUser]
            ];

            let inspectionCodesContent = [];
            if (aInspectionCodes.length > 0) {
                inspectionCodesContent = [
                    {
                        text: 'INSPECTION CODES',
                        style: 'sectionHeader',
                        margin: [0, 20, 0, 10]
                    },
                    {
                        style: 'codesTable',
                        table: {
                            widths: [60, '*'],
                            headerRows: 1,
                            body: [
                                [
                                    { text: 'Code', style: 'tableHeader', fillColor: '#0854A0', color: '#FFFFFF' },
                                    { text: 'Description', style: 'tableHeader', fillColor: '#0854A0', color: '#FFFFFF' }
                                ],
                                ...aInspectionCodes.map(code => [
                                    code.CodeValue || '',
                                    code.CodeText || ''
                                ])
                            ]
                        },
                        layout: 'lightHorizontalLines',
                        margin: [0, 0, 0, 20]
                    }
                ];
            }

            return {
                info: {
                    title: `${sType === 'B' ? 'Before' : 'After'} Loading Images`,
                    author: 'Inspection Tracker',
                    subject: `Container Inspection - ${document}`
                },
                pageSize: 'A4',
                pageOrientation: 'landscape',
                pageMargins: [40, 60, 40, 60],
                header: {
                    text: 'CONTAINER INSPECTION REPORT',
                    style: 'header',
                    alignment: 'center',
                    margin: [0, 20, 0, 0]
                },
                footer: function (currentPage, pageCount) {
                    return {
                        text: `Page ${currentPage} of ${pageCount}`,
                        alignment: 'center',
                        margin: [0, 10, 0, 0]
                    };
                },
                content: [
                    {
                        text: `${sType === 'B' ? 'BEFORE' : 'AFTER'} LOADING IMAGES`,
                        style: 'title',
                        margin: [0, 0, 0, 20]
                    },
                    {
                        style: 'metadataTable',
                        table: {
                            widths: [120, '*'],
                            body: metadataTableBody
                        },
                        layout: 'lightHorizontalLines',
                        margin: [0, 0, 0, 10]
                    },
                    ...inspectionCodesContent,
                    { text: '', pageBreak: 'after' },
                    ...imageContent
                ],
                styles: {
                    header: {
                        fontSize: 20,
                        bold: true,
                        color: '#0854A0'
                    },
                    title: {
                        fontSize: 14,
                        bold: true,
                        alignment: 'center',
                        color: '#0854A0'
                    },
                    metadataTable: {
                        fontSize: 11,
                        margin: [0, 5, 0, 15]
                    },
                    sectionHeader: {
                        fontSize: 14,
                        bold: true,
                        color: '#0854A0'
                    },
                    tableHeader: {
                        fontSize: 11,
                        bold: true
                    },
                    codesTable: {
                        fontSize: 10,
                        margin: [0, 5, 0, 15]
                    },
                    imageHeader: {
                        fontSize: 16,
                        bold: true,
                        color: '#0854A0'
                    },
                    timestamp: {
                        fontSize: 10,
                        italics: true,
                        color: '#666666'
                    }
                }
            };
        },

        /**
         * Generate PDF from definition
         * @param {object} docDefinition - PDF definition
         * @returns {Promise<string>} Promise resolving with base64 PDF
         */
        async generatePDF(docDefinition) {
            const pdfMakeInstance = pdfMakeLoader.getInstance();

            console.log("=== DEBUG pdfMakeInstance ===");
            console.log("pdfMakeInstance:", pdfMakeInstance);
            console.log("typeof pdfMakeInstance:", typeof pdfMakeInstance);
            console.log("pdfMakeInstance?.createPdf:", typeof pdfMakeInstance?.createPdf);

            if (!pdfMakeInstance || typeof pdfMakeInstance.createPdf !== "function") {
                console.error("FAILED CHECK - Instance or createPdf missing");
                throw new Error("pdfMake not properly loaded - instance: " + typeof pdfMakeInstance + ", createPdf: " + typeof pdfMakeInstance?.createPdf);
            }

            console.log("pdfMake instance retrieved successfully");

            const pdfBase64 = await new Promise((resolve,reject) => {
                try{
                    pdfMakeInstance.createPdf(docDefinition).getBase64(resolve);
                }catch(err){
                    reject(err);
                }
                
            });

            console.log("PDF created successfully, length:", pdfBase64.length);
            return pdfBase64;
        },

        /**
         * Convert base64 to Blob
         * @param {string} pdfBase64 - Base64 PDF string
         * @returns {Blob} PDF blob
         */
        base64ToBlob(pdfBase64) {
            const byteCharacters = atob(pdfBase64);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const pdfBlob = new Blob([byteArray], { type: "application/pdf" });

            console.log("PDF Blob created, size:", (pdfBlob.size / 1024 / 1024).toFixed(2), "MB");
            return pdfBlob;
        },

        /**
         * Generate slug for PDF upload
         * @param {string} document - Document number
         * @param {string} imageType - Image type (B/A)
         * @returns {string} Slug string
         */
        generateSlug(document, carrier, imageType) {
            if (!document) {
                throw new Error("Document number missing");
            }

            const label = imageType === "B" ? "Before_Image" : "After_Image";

            const fileName = `${carrier}-${label}.pdf`;

            return `${document}/${fileName}`;
        }
    };
});
