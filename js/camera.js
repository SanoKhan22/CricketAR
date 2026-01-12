/**
 * Camera Module - WebRTC camera handling
 */

export class Camera {
    constructor() {
        this.videoElement = null;
        this.stream = null;
        this.isRunning = false;
        this.facingMode = 'user'; // 'user' for front, 'environment' for back
    }

    /**
     * Initialize camera with video element
     */
    async init(videoElementId) {
        this.videoElement = document.getElementById(videoElementId);

        if (!this.videoElement) {
            throw new Error(`Video element with id "${videoElementId}" not found`);
        }

        // Check for camera support
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error('Camera not supported in this browser');
        }

        return this;
    }

    /**
     * Start camera stream with fallback options
     */
    async start() {
        // Stop any existing stream first
        this.stop();

        // Try different constraint options in order of preference
        const constraintOptions = [
            // First try: High quality
            {
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: false
            },
            // Fallback: Lower quality
            {
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 30 }
                },
                audio: false
            },
            // Last resort: Basic video
            {
                video: { facingMode: this.facingMode },
                audio: false
            },
            // Absolute fallback: Any camera
            {
                video: true,
                audio: false
            }
        ];

        let lastError = null;

        for (const constraints of constraintOptions) {
            try {
                console.log('Trying camera with constraints:', JSON.stringify(constraints));
                this.stream = await navigator.mediaDevices.getUserMedia(constraints);
                this.videoElement.srcObject = this.stream;

                // Wait for video to be ready
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('Video load timeout')), 5000);
                    this.videoElement.onloadedmetadata = () => {
                        clearTimeout(timeout);
                        this.videoElement.play();
                        resolve();
                    };
                });

                this.isRunning = true;
                console.log('✅ Camera started successfully');

                return {
                    width: this.videoElement.videoWidth,
                    height: this.videoElement.videoHeight
                };
            } catch (error) {
                console.warn('Camera attempt failed:', error.message);
                lastError = error;
                // Stop stream if partially started
                if (this.stream) {
                    this.stream.getTracks().forEach(track => track.stop());
                    this.stream = null;
                }
            }
        }

        // All attempts failed
        console.error('❌ All camera options failed. Last error:', lastError);

        // Show user-friendly error message
        const errorMessage = lastError?.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access and reload.'
            : lastError?.name === 'NotFoundError'
                ? 'No camera found. Please connect a camera.'
                : 'Camera error. Please close other apps using the camera and reload.';

        alert(errorMessage);
        throw lastError;
    }

    /**
     * Stop camera stream
     */
    stop() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.isRunning = false;
    }

    /**
     * Toggle between front and back camera
     */
    async toggleCamera() {
        this.facingMode = this.facingMode === 'user' ? 'environment' : 'user';
        this.stop();
        await this.start();
    }

    /**
     * Get video dimensions
     */
    getDimensions() {
        return {
            width: this.videoElement.videoWidth,
            height: this.videoElement.videoHeight
        };
    }

    /**
     * Get video element
     */
    getVideoElement() {
        return this.videoElement;
    }
}
