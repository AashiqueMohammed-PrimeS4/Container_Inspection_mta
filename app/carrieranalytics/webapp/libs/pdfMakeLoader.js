sap.ui.define([
    "sap/ui/thirdparty/jquery"
], function(jQuery) {
    "use strict";

    /**
     * Module for loading pdfMake library
     * @namespace carrieranalytics.libs.pdfMakeLoader
     */
    return {
        /**
         * Load pdfMake and vfs_fonts libraries
         * @returns {Promise} Promise that resolves when libraries are loaded
         */
        load: function() {
            return new Promise(function(resolve, reject) {
                // Check if already loaded
                if (typeof window.pdfMake !== "undefined" &&
                    typeof window.pdfMake.createPdf === "function" &&
                    window.pdfMake.vfs) {
                    console.log("pdfMake already loaded");
                    resolve(window.pdfMake);
                    return;
                }

                // Get the base URL for the library path
                var sLibPath = sap.ui.require.toUrl("carrieranalytics/libs");

                // Load pdfMake core library
                // Force UMD to use window by temporarily removing module/define
                var tempModule = window.module;
                var tempDefine = window.define;
                var tempExports = window.exports;

                delete window.module;
                delete window.define;
                delete window.exports;

                jQuery.ajax({
                    url: sLibPath + "/pdfmake.min.js",
                    dataType: "script",
                    cache: true,
                    success: function() {
                        // Restore module/define/exports
                        if (tempModule) window.module = tempModule;
                        if (tempDefine) window.define = tempDefine;
                        if (tempExports) window.exports = tempExports;

                        console.log("pdfmake.min.js loaded");
                        console.log("window.pdfMake after load:", typeof window.pdfMake);

                        // Store the pdfMake library reference BEFORE loading vfs_fonts
                        var pdfMakeLib = window.pdfMake;

                        // Load vfs_fonts library
                        jQuery.ajax({
                            url: sLibPath + "/vfs_fonts.js",
                            dataType: "script",
                            cache: true,
                            success: function() {
                                console.log("vfs_fonts.js loaded");

                                // pdfMake library should already be on window from the first script
                                // vfs_fonts might overwrite window.pdfMake with just {vfs: ...}
                                // so we need to restore the actual library and attach vfs to it

                                var vfsData = null;

                                // Check if window.pdfMake got overwritten with just vfs
                                if (window.pdfMake && window.pdfMake.vfs && !window.pdfMake.createPdf) {
                                    console.log("window.pdfMake was overwritten with just vfs, restoring...");
                                    vfsData = window.pdfMake.vfs;
                                    window.pdfMake = pdfMakeLib; // Restore the actual library
                                }

                                // Check pdfFonts global
                                if (window.pdfFonts) {
                                    if (window.pdfFonts.pdfMake && window.pdfFonts.pdfMake.vfs) {
                                        vfsData = window.pdfFonts.pdfMake.vfs;
                                    } else if (window.pdfFonts.vfs) {
                                        vfsData = window.pdfFonts.vfs;
                                    }
                                }

                                // Attach vfs to the actual pdfMake library
                                if (vfsData && window.pdfMake) {
                                    window.pdfMake.vfs = vfsData;
                                }

                                console.log("Final pdfMake loaded successfully");
                                console.log("pdfMake type:", typeof window.pdfMake);
                                console.log("pdfMake.createPdf type:", typeof window.pdfMake?.createPdf);
                                console.log("pdfMake.vfs available:", window.pdfMake?.vfs ? "YES" : "NO");

                                if (!window.pdfMake || typeof window.pdfMake.createPdf !== "function") {
                                    reject(new Error("pdfMake library did not load properly - createPdf function not found"));
                                    return;
                                }

                                resolve(window.pdfMake);
                            },
                            error: function(jqXHR, textStatus, errorThrown) {
                                console.error("Failed to load vfs_fonts.js:", textStatus, errorThrown);
                                reject(new Error("Failed to load vfs_fonts: " + textStatus));
                            }
                        });
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        console.error("Failed to load pdfmake.min.js:", textStatus, errorThrown);
                        reject(new Error("Failed to load pdfMake: " + textStatus));
                    }
                });
            });
        },

        /**
         * Get the loaded pdfMake instance
         * @returns {object|null} pdfMake instance or null if not loaded
         */
        getInstance: function() {
            console.log("getInstance called - window.pdfMake:", typeof window.pdfMake);

            if (window.pdfMake) {
                console.log("window.pdfMake keys:", Object.keys(window.pdfMake));
                console.log("window.pdfMake.createPdf:", typeof window.pdfMake.createPdf);
                console.log("window.pdfMake.vfs:", window.pdfMake.vfs ? "EXISTS" : "MISSING");

                // If createPdf doesn't exist directly, check nested structures
                if (!window.pdfMake.createPdf) {
                    console.warn("createPdf not found on window.pdfMake, checking nested properties...");

                    // Try to find createPdf in nested objects
                    for (var key in window.pdfMake) {
                        if (window.pdfMake[key] && typeof window.pdfMake[key].createPdf === "function") {
                            console.log("Found createPdf in window.pdfMake." + key);
                            return window.pdfMake[key];
                        }
                    }
                }

                return window.pdfMake;
            }

            console.error("pdfMake not found on window object!");
            return null;
        }
    };
});
