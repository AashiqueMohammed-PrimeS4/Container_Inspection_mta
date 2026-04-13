sap.ui.define([
    "sap/m/MessageToast"
], (MessageToast) => {
    "use strict";

    return {
        _stream: null,
        _videoElement: null,

        /**
         * Initialize camera stream
         * @param {HTMLElement} containerDom - Container DOM element
         * @returns {Promise} Promise resolving with video element
         */
        initializeCamera(containerDom) {
            return new Promise((resolve, reject) => {
                containerDom.innerHTML = "";

                const video = document.createElement("video");
                video.id = "cameraVideo";
                video.setAttribute("autoplay", true);
                video.style.width = "100%";
                video.style.height = "100%";
                video.style.objectFit = "cover";
                video.style.position = "relative";
                containerDom.appendChild(video);

                // Get screen orientation to request appropriate resolution
                const isPortrait = window.innerHeight > window.innerWidth;

                navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: "environment",
                        width: { ideal: isPortrait ? 720 : 1280 },
                        height: { ideal: isPortrait ? 1280 : 720 }
                    }
                })
                .then((stream) => {
                    this._stream = stream;
                    video.srcObject = stream;

                    // Wait for video metadata to be loaded to get actual dimensions
                    video.onloadedmetadata = () => {
                        console.log(`📹 Video loaded - Dimensions: ${video.videoWidth}x${video.videoHeight}`);
                        this._videoElement = video;
                        resolve(video);
                    };
                })
                .catch((err) => {
                    MessageToast.show("Cannot access camera: " + err);
                    reject(err);
                });
            });
        },

        /**
         * Capture image from video stream
         * @param {HTMLVideoElement} video - Video element
         * @param {string} imageType - Image type (B/A)
         * @returns {object} Image data object
         */
        captureImage(video, imageType) {
            if (!video) {
                throw new Error("Video not ready!");
            }

            const canvas = document.createElement("canvas");
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            canvas.getContext("2d").drawImage(video, 0, 0);

            const dataURL = canvas.toDataURL("image/jpeg", 0.8);

            return {
                id: Date.now().toString(),
                base64: dataURL,
                timestamp: new Date().toISOString(),
                type: imageType
            };
        },

        /**
         * Cleanup camera resources
         */
        cleanupCamera() {
            if (this._stream) {
                this._stream.getTracks().forEach(track => track.stop());
                this._stream = null;
            }

            if (this._videoElement) {
                if (this._videoElement.srcObject) {
                    this._videoElement.srcObject = null;
                }
                if (this._videoElement.parentNode) {
                    this._videoElement.parentNode.removeChild(this._videoElement);
                }
                this._videoElement = null;
            }
        },

        /**
         * Get current video element
         * @returns {HTMLVideoElement} Video element
         */
        getVideoElement() {
            return this._videoElement;
        },

        /**
         * Delete image from array
         * @param {array} aImages - Images array
         * @param {number} iIndex - Index to delete
         * @returns {array} Updated images array
         */
        deleteImage(aImages, iIndex) {
            const updatedImages = [...aImages];
            updatedImages.splice(iIndex, 1);
            return updatedImages;
        },

        /**
         * Add image to gallery
         * @param {array} aImages - Current images array
         * @param {object} oImageData - Image data object
         * @returns {array} Updated images array
         */
        addImage(aImages, oImageData) {
            const updatedImages = [...aImages];
            updatedImages.push(oImageData);
            return updatedImages;
        },

        /**
         * Clear camera container
         * @param {string} containerId - Container ID
         */
        clearCameraContainer(containerId) {
            const oContainer = sap.ui.getCore().byId(containerId);
            if (oContainer && oContainer.getDomRef()) {
                oContainer.getDomRef().innerHTML = "";
            }
        }
    };
});