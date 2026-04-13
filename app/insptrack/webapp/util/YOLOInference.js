sap.ui.define([], () => {
    "use strict";
    const CF_HOST = "https://model-host.a2916c6.kyma.ondemand.com";
    return {
        session: null,
        inputWidth: 640,
        inputHeight: 640,
        _onnxLoaded: false,

        async _loadONNXRuntime() {
            if (this._onnxLoaded && typeof window.ort !== 'undefined') {
                return;
            }

            return new Promise((resolve, reject) => {
                const scriptPath = `${CF_HOST}/lib/ort.min.js`;

                if (document.querySelector(`script[src="${scriptPath}"]`)) {
                    this._onnxLoaded = true;
                    resolve();
                    return;
                }

                const script = document.createElement('script');
                script.src = scriptPath;
                script.crossOrigin = "anonymous";  ;  // Enable CORS for script loading
                script.onload = () => {
                    console.log("✅ ONNX Runtime loaded from:", scriptPath);
                    this._onnxLoaded = true;
                    resolve();
                };
                script.onerror = (error) => {
                    console.error("❌ Script load failed:", error);
                    console.error("This may be a CORS issue. Attempting fallback...");
                    // Try again without crossOrigin as fallback
                    const fallbackScript = document.createElement('script');
                    fallbackScript.src = scriptPath;
                    fallbackScript.onload = () => {
                        console.log("✅ ONNX Runtime loaded (via fallback)");
                        this._onnxLoaded = true;
                        resolve();
                    };
                    fallbackScript.onerror = () => {
                        reject(new Error("Failed to load ONNX Runtime from " + scriptPath));
                    };
                    document.head.appendChild(fallbackScript);
                };
                document.head.appendChild(script);
            });
        },

        async loadModel() {
            if (this.session) {
                return this.session;
            }

            try {
                
                await this._loadONNXRuntime();
                await new Promise(resolve => setTimeout(resolve, 500));

                if (typeof window.ort === 'undefined') {
                    throw new Error("ONNX Runtime not available");
                }
                
                const ort = window.ort;

                // Configure WASM for ONNX Runtime 1.19.0
                ort.env.wasm.numThreads = 1;
                ort.env.wasm.wasmPaths = {
                    "wasm-wasm": `${CF_HOST}/lib/ort-wasm.wasm`,
                    "wasm-simd": `${CF_HOST}/lib/ort-wasm-simd.wasm`
                };



                const modelPath = `${CF_HOST}/models/container_model.onnx`;
                console.log("📦 Loading model from:", modelPath);

                this.session = await ort.InferenceSession.create(modelPath, {
                    executionProviders: ['wasm']
                });

                console.log("✅ Model loaded! Input:", this.session.inputNames[0]);
                return this.session;
            } catch (error) {
                console.error("❌ Load failed:", error);
                throw error;
            }
        },

        preprocessImage(imageElement) {
            const canvas = document.createElement('canvas');
            canvas.width = this.inputWidth;
            canvas.height = this.inputHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(imageElement, 0, 0, this.inputWidth, this.inputHeight);

            const imageData = ctx.getImageData(0, 0, this.inputWidth, this.inputHeight);
            const pixels = imageData.data;

            const red = [], green = [], blue = [];
            for (let i = 0; i < pixels.length; i += 4) {
                red.push(pixels[i] / 255.0);
                green.push(pixels[i + 1] / 255.0);
                blue.push(pixels[i + 2] / 255.0);
            }

            return {
                data: Float32Array.from([...red, ...green, ...blue]),
                dims: [1, 3, this.inputHeight, this.inputWidth]
            };
        },

        async runInference(imageElement) {
            if (!this.session) await this.loadModel();

            console.log("🔄 Running inference...");
            const tensorData = this.preprocessImage(imageElement);
            const tensor = new window.ort.Tensor('float32', tensorData.data, tensorData.dims);

            const feeds = {};
            feeds[this.session.inputNames[0]] = tensor;
            const results = await this.session.run(feeds);
            const output = results[this.session.outputNames[0]];

            return this.processOutput(output, imageElement.width, imageElement.height);
        },

        processOutput(output, originalWidth, originalHeight) {
            const boxes = [];
            const data = output.data;
            const numDetections = output.dims[2] || 8400;

            for (let i = 0; i < numDetections; i++) {
                const confidence = data[4 * numDetections + i];
                if (confidence > 0.3) {
                    const xCenter = data[0 * numDetections + i];
                    const yCenter = data[1 * numDetections + i];
                    const width = data[2 * numDetections + i];
                    const height = data[3 * numDetections + i];

                    const scaleX = originalWidth / this.inputWidth;
                    const scaleY = originalHeight / this.inputHeight;

                    boxes.push({
                        x1: Math.max(0, (xCenter - width / 2) * scaleX),
                        y1: Math.max(0, (yCenter - height / 2) * scaleY),
                        x2: Math.min(originalWidth, (xCenter + width / 2) * scaleX),
                        y2: Math.min(originalHeight, (yCenter + height / 2) * scaleY),
                        confidence: confidence,
                        classId: 0
                    });
                }
            }

            const final = this.nonMaxSuppression(boxes, 0.4);
            console.log(`✅ Detected ${final.length} regions`);
            return final;
        },

        nonMaxSuppression(boxes, threshold) {
            boxes.sort((a, b) => b.confidence - a.confidence);
            const selected = [];
            const active = new Array(boxes.length).fill(true);

            for (let i = 0; i < boxes.length; i++) {
                if (!active[i]) continue;
                selected.push(boxes[i]);

                for (let j = i + 1; j < boxes.length; j++) {
                    if (active[j] && this.calculateIoU(boxes[i], boxes[j]) > threshold) {
                        active[j] = false;
                    }
                }
            }
            return selected;
        },

        calculateIoU(box1, box2) {
            const x1 = Math.max(box1.x1, box2.x1);
            const y1 = Math.max(box1.y1, box2.y1);
            const x2 = Math.min(box1.x2, box2.x2);
            const y2 = Math.min(box1.y2, box2.y2);
            const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
            const union = (box1.x2 - box1.x1) * (box1.y2 - box1.y1) +
                (box2.x2 - box2.x1) * (box2.y2 - box2.y1) - intersection;
            return intersection / union;
        }
    };
});