/**
 * Hand Tracking Module - MediaPipe Hands integration
 */

export class HandTracking {
    constructor() {
        this.hands = null;
        this.camera = null;
        this.isRunning = false;
        this.onResultsCallback = null;

        // Hand tracking data
        this.currentHands = [];
        this.previousHands = [];
        this.handVelocity = { x: 0, y: 0, z: 0 };

        // Performance optimization
        this.lastUpdateTime = 0;
        this.frameSkip = 2; // Process every Nth frame
        this.frameCount = 0;
    }

    /**
     * Initialize MediaPipe Hands
     */
    async init() {
        return new Promise((resolve, reject) => {
            try {
                // @ts-ignore - MediaPipe is loaded via CDN
                this.hands = new Hands({
                    locateFile: (file) => {
                        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`;
                    }
                });

                this.hands.setOptions({
                    maxNumHands: 2,
                    modelComplexity: 0, // 0 = Lite (fastest), 1 = Full
                    minDetectionConfidence: 0.5,
                    minTrackingConfidence: 0.5
                });

                this.hands.onResults((results) => this.processResults(results));

                console.log('Hand tracking initialized');
                resolve(this);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Start hand tracking with video element
     */
    async start(videoElement) {
        // @ts-ignore - MediaPipe Camera is loaded via CDN as 'Camera'
        // We access it via window to avoid confusion with our Camera module
        const MPCamera = window.Camera;
        this.camera = new MPCamera(videoElement, {
            onFrame: async () => {
                this.frameCount++;

                // Skip frames for performance
                if (this.frameCount % this.frameSkip !== 0) {
                    return;
                }

                if (this.hands && this.isRunning) {
                    await this.hands.send({ image: videoElement });
                }
            },
            width: videoElement.videoWidth || 1280,
            height: videoElement.videoHeight || 720
        });

        await this.camera.start();
        this.isRunning = true;
        console.log('Hand tracking started');
    }

    /**
     * Process hand tracking results
     */
    processResults(results) {
        // Store previous hands for velocity calculation
        this.previousHands = [...this.currentHands];

        // Update current hands
        this.currentHands = results.multiHandLandmarks || [];

        // Calculate hand velocity if we have data
        if (this.previousHands.length > 0 && this.currentHands.length > 0) {
            this.calculateHandVelocity();
        }

        // Call external callback if set
        if (this.onResultsCallback) {
            this.onResultsCallback({
                hands: this.currentHands,
                handedness: results.multiHandedness || [],
                velocity: this.handVelocity,
                timestamp: Date.now()
            });
        }
    }

    /**
     * Calculate hand movement velocity
     */
    calculateHandVelocity() {
        const current = this.currentHands[0];
        const previous = this.previousHands[0];

        if (!current || !previous) return;

        // Use palm center (landmark 9) for velocity
        const currentPalm = current[9];
        const previousPalm = previous[9];

        const now = Date.now();
        const dt = (now - this.lastUpdateTime) / 1000; // seconds
        this.lastUpdateTime = now;

        if (dt > 0 && dt < 1) { // Sanity check
            this.handVelocity = {
                x: (currentPalm.x - previousPalm.x) / dt,
                y: (currentPalm.y - previousPalm.y) / dt,
                z: (currentPalm.z - previousPalm.z) / dt
            };
        }
    }

    /**
     * Get current hand positions
     */
    getHands() {
        return this.currentHands;
    }

    /**
     * Get hand velocity (for swing detection)
     */
    getVelocity() {
        return this.handVelocity;
    }

    /**
     * Check if hand is in swing motion
     */
    isSwinging(threshold = 1.5) {
        const speed = Math.sqrt(
            this.handVelocity.x ** 2 +
            this.handVelocity.y ** 2
        );
        return speed > threshold;
    }

    /**
     * Get swing direction
     */
    getSwingDirection() {
        const vx = this.handVelocity.x;
        const vy = this.handVelocity.y;

        if (Math.abs(vx) < 0.5 && Math.abs(vy) < 0.5) {
            return 'none';
        }

        // Determine primary direction
        if (Math.abs(vx) > Math.abs(vy)) {
            return vx > 0 ? 'right' : 'left';
        } else {
            return vy > 0 ? 'down' : 'up';
        }
    }

    /**
     * Get palm position (normalized 0-1)
     */
    getPalmPosition() {
        if (this.currentHands.length === 0) return null;

        const hand = this.currentHands[0];
        const palm = hand[9]; // Middle finger base

        return {
            x: palm.x,
            y: palm.y,
            z: palm.z
        };
    }

    /**
     * Set callback for hand tracking results
     */
    onResults(callback) {
        this.onResultsCallback = callback;
    }

    /**
     * Stop hand tracking
     */
    stop() {
        this.isRunning = false;
        if (this.camera) {
            this.camera.stop();
        }
    }

    /**
     * Draw hand landmarks on canvas
     */
    drawHands(canvasCtx, width, height) {
        if (!this.currentHands.length) return;

        canvasCtx.save();
        canvasCtx.clearRect(0, 0, width, height);

        for (const landmarks of this.currentHands) {
            // Draw connections
            this.drawConnections(canvasCtx, landmarks, width, height);

            // Draw landmarks
            this.drawLandmarks(canvasCtx, landmarks, width, height);
        }

        canvasCtx.restore();
    }

    /**
     * Draw hand landmark points
     */
    drawLandmarks(ctx, landmarks, width, height) {
        for (let i = 0; i < landmarks.length; i++) {
            const landmark = landmarks[i];
            const x = landmark.x * width;
            const y = landmark.y * height;

            ctx.beginPath();
            ctx.arc(x, y, 5, 0, 2 * Math.PI);
            ctx.fillStyle = i === 9 ? '#00d4aa' : '#7c3aed'; // Highlight palm center
            ctx.fill();
        }
    }

    /**
     * Draw connections between landmarks
     */
    drawConnections(ctx, landmarks, width, height) {
        const connections = [
            [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
            [0, 5], [5, 6], [6, 7], [7, 8], // Index
            [0, 9], [9, 10], [10, 11], [11, 12], // Middle
            [0, 13], [13, 14], [14, 15], [15, 16], // Ring
            [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
            [5, 9], [9, 13], [13, 17] // Palm
        ];

        ctx.strokeStyle = 'rgba(124, 58, 237, 0.5)';
        ctx.lineWidth = 2;

        for (const [start, end] of connections) {
            const startPoint = landmarks[start];
            const endPoint = landmarks[end];

            ctx.beginPath();
            ctx.moveTo(startPoint.x * width, startPoint.y * height);
            ctx.lineTo(endPoint.x * width, endPoint.y * height);
            ctx.stroke();
        }
    }
}
