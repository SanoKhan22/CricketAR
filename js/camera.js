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
     * Start camera stream
     */
    async start() {
        try {
            // Camera constraints optimized for performance
            const constraints = {
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 30, max: 60 }
                },
                audio: false
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            
            // Wait for video to be ready
            await new Promise((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });

            this.isRunning = true;
            console.log('Camera started successfully');
            
            return {
                width: this.videoElement.videoWidth,
                height: this.videoElement.videoHeight
            };
        } catch (error) {
            console.error('Failed to start camera:', error);
            throw error;
        }
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
