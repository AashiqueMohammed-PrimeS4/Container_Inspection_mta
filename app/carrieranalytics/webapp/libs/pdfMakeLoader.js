sap.ui.define([], function() {
    "use strict";

    /**
     * Load a script by injecting a <script src> tag.
     * Unlike jQuery.ajax dataType:"script", this is NOT subject to CSP unsafe-inline
     * because the browser treats external <script src> as a non-inline script,
     * which is permitted by 'script-src *'.
     */
    function loadScriptTag(url) {
        return new Promise(function(resolve, reject) {
            var script = document.createElement("script");
            script.src = url;
            script.onload = resolve;
            script.onerror = function() {
                reject(new Error("Failed to load script: " + url));
            };
            document.head.appendChild(script);
        });
    }

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

                var sLibPath = sap.ui.require.toUrl("carrieranalytics/libs");

                // Suppress AMD/CommonJS so both libraries attach to window globals.
                // Must stay suppressed across both loads — vfs_fonts loaded with
                // window.define active would register via AMD (async) and never
                // set window.pdfMake.vfs before the onload callback fires.
                var tempModule = window.module;
                var tempDefine = window.define;
                var tempExports = window.exports;
                window.module = undefined;
                window.define = undefined;
                window.exports = undefined;

                loadScriptTag(sLibPath + "/pdfmake.min.js").then(function() {
                    console.log("pdfmake.min.js loaded, createPdf:", typeof window.pdfMake?.createPdf);

                    var pdfMakeLib = window.pdfMake;

                    return loadScriptTag(sLibPath + "/vfs_fonts.js").then(function() {
                        // Restore module system after both scripts executed
                        if (tempModule) window.module = tempModule;
                        if (tempDefine) window.define = tempDefine;
                        if (tempExports) window.exports = tempExports;

                        console.log("vfs_fonts.js loaded");

                        var vfsData = null;

                        // vfs_fonts may overwrite window.pdfMake with just {vfs:...}
                        if (window.pdfMake && window.pdfMake.vfs && !window.pdfMake.createPdf) {
                            console.log("Restoring pdfMake core overwritten by vfs_fonts...");
                            vfsData = window.pdfMake.vfs;
                            window.pdfMake = pdfMakeLib;
                        } else if (window.pdfMake && window.pdfMake.vfs) {
                            vfsData = window.pdfMake.vfs;
                        }

                        // Fallback: check pdfFonts global
                        if (!vfsData && window.pdfFonts) {
                            vfsData = (window.pdfFonts.pdfMake && window.pdfFonts.pdfMake.vfs)
                                || window.pdfFonts.vfs;
                        }

                        // Always prefer the captured core reference
                        if (!window.pdfMake || typeof window.pdfMake.createPdf !== "function") {
                            window.pdfMake = pdfMakeLib;
                        }
                        if (vfsData) {
                            window.pdfMake.vfs = vfsData;
                        }

                        console.log("pdfMake.createPdf:", typeof window.pdfMake?.createPdf);
                        console.log("pdfMake.vfs:", window.pdfMake?.vfs ? "YES" : "NO");

                        if (!window.pdfMake || typeof window.pdfMake.createPdf !== "function") {
                            reject(new Error("pdfMake library did not load properly - createPdf function not found"));
                            return;
                        }
                        resolve(window.pdfMake);
                    });
                }).catch(function(err) {
                    if (tempModule) window.module = tempModule;
                    if (tempDefine) window.define = tempDefine;
                    if (tempExports) window.exports = tempExports;
                    console.error("Script load error:", err);
                    reject(err);
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
