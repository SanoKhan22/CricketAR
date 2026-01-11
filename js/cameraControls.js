/**
 * Camera Controls Module - Google Maps-style camera interaction
 * - Mouse drag to pan/rotate camera
 * - Mouse wheel to zoom in/out
 */

export class CameraControls {
    constructor(camera, canvas) {
        this.camera = camera;
        this.canvas = canvas;

        // Camera state
        this.enabled = true;
        this.spherical = {
            radius: 40,      // Distance from center
            theta: 0,        // Horizontal angle (radians)
            phi: Math.PI / 3 // Vertical angle (radians, 60 degrees)
        };

        // Limits
        this.minRadius = 10;
        this.maxRadius = 120;
        this.minPhi = 0.1;  // Don't go completely horizontal
        this.maxPhi = Math.PI / 2 - 0.1; // Don't go completely vertical

        // Mouse state
        this.isDragging = false;
        this.previousMousePosition = { x: 0, y: 0 };

        // Target for smooth camera (look-at point)
        this.target = { x: 0, y: 1, z: 5 };

        // === NEW: Camera Presets ===
        this.presets = {
            // Behind batsman (default)
            behind: { radius: 40, theta: 0, phi: Math.PI / 3, target: { x: 0, y: 1, z: 10 } },

            // Side view (off side) - looking from point/cover
            sideOff: { radius: 35, theta: Math.PI / 2, phi: Math.PI / 4, target: { x: 0, y: 1, z: 5 } },

            // Side view (leg side) - looking from square leg
            sideLeg: { radius: 35, theta: -Math.PI / 2, phi: Math.PI / 4, target: { x: 0, y: 1, z: 5 } },

            // Bowler's view
            bowler: { radius: 50, theta: Math.PI, phi: Math.PI / 6, target: { x: 0, y: 1, z: 10 } },

            // Zoomed in (for batting, close to action)
            closeUp: { radius: 25, theta: 0, phi: Math.PI / 4, target: { x: 0, y: 1.5, z: 9 } },

            // Zoomed out (for ball tracking after hit)
            wide: { radius: 80, theta: 0, phi: Math.PI / 3, target: { x: 0, y: 0, z: 30 } }
        };

        // === NEW: Smooth Transition Animation ===
        this.isAnimating = false;
        this.animationStartTime = 0;
        this.animationDuration = 800; // ms
        this.startState = null;
        this.targetState = null;

        // Bind event handlers
        this.onMouseDown = this.onMouseDown.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onMouseUp = this.onMouseUp.bind(this);
        this.onWheel = this.onWheel.bind(this);

        this.init();
    }

    /**
     * Initialize event listeners
     */
    init() {
        this.canvas.addEventListener('mousedown', this.onMouseDown);
        this.canvas.addEventListener('mousemove', this.onMouseMove);
        this.canvas.addEventListener('mouseup', this.onMouseUp);
        this.canvas.addEventListener('mouseleave', this.onMouseUp);
        this.canvas.addEventListener('wheel', this.onWheel, { passive: false });

        // Touch support for mobile
        this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.onMouseUp);

        // Set initial cursor
        this.canvas.style.cursor = this.enabled ? 'grab' : 'default';

        console.log('Camera controls initialized: Drag to pan, scroll to zoom');
    }

    /**
     * Mouse down - start dragging
     */
    onMouseDown(event) {
        if (!this.enabled) return;

        this.isDragging = true;
        this.previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };

        this.canvas.style.cursor = 'grabbing';
    }

    /**
     * Mouse move - rotate camera
     */
    onMouseMove(event) {
        if (!this.enabled || !this.isDragging) return;

        const deltaX = event.clientX - this.previousMousePosition.x;
        const deltaY = event.clientY - this.previousMousePosition.y;

        // Rotate horizontally (theta)
        this.spherical.theta -= deltaX * 0.005;

        // Rotate vertically (phi)
        this.spherical.phi -= deltaY * 0.005;

        // Clamp phi to limits
        this.spherical.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.spherical.phi));

        this.previousMousePosition = {
            x: event.clientX,
            y: event.clientY
        };

        this.updateCameraPosition();
    }

    /**
     * Mouse up - stop dragging
     */
    onMouseUp() {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }

    /**
     * Mouse wheel - zoom in/out
     */
    onWheel(event) {
        if (!this.enabled) return;

        event.preventDefault();

        // Zoom in/out
        const zoomSpeed = 0.1;
        const delta = event.deltaY > 0 ? 1 : -1;

        this.spherical.radius += delta * this.spherical.radius * zoomSpeed;

        // Clamp radius to limits
        this.spherical.radius = Math.max(this.minRadius, Math.min(this.maxRadius, this.spherical.radius));

        this.updateCameraPosition();
    }

    /**
     * Touch start
     */
    onTouchStart(event) {
        if (!this.enabled || event.touches.length !== 1) return;

        this.isDragging = true;
        this.previousMousePosition = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };
    }

    /**
     * Touch move
     */
    onTouchMove(event) {
        if (!this.enabled || !this.isDragging || event.touches.length !== 1) return;

        event.preventDefault();

        const deltaX = event.touches[0].clientX - this.previousMousePosition.x;
        const deltaY = event.touches[0].clientY - this.previousMousePosition.y;

        this.spherical.theta -= deltaX * 0.005;
        this.spherical.phi -= deltaY * 0.005;
        this.spherical.phi = Math.max(this.minPhi, Math.min(this.maxPhi, this.spherical.phi));

        this.previousMousePosition = {
            x: event.touches[0].clientX,
            y: event.touches[0].clientY
        };

        this.updateCameraPosition();
    }

    /**
     * Update camera position from spherical coordinates
     */
    updateCameraPosition() {
        // Convert spherical to Cartesian coordinates
        const x = this.target.x + this.spherical.radius * Math.sin(this.spherical.phi) * Math.sin(this.spherical.theta);
        const y = this.target.y + this.spherical.radius * Math.cos(this.spherical.phi);
        const z = this.target.z + this.spherical.radius * Math.sin(this.spherical.phi) * Math.cos(this.spherical.theta);

        this.camera.position.set(x, y, z);
        this.camera.lookAt(this.target.x, this.target.y, this.target.z);
    }

    /**
     * Set camera to specific view
     */
    setView(radius, theta, phi) {
        this.spherical.radius = radius;
        this.spherical.theta = theta;
        this.spherical.phi = phi;
        this.updateCameraPosition();
    }

    /**
     * Reset to default view
     */
    reset() {
        this.spherical.radius = 40;
        this.spherical.theta = 0;
        this.spherical.phi = Math.PI / 3;
        this.updateCameraPosition();
    }

    /**
     * Enable/disable controls
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        this.canvas.style.cursor = enabled ? 'grab' : 'default';
    }

    /**
     * Set look-at target
     */
    setTarget(x, y, z) {
        this.target.x = x;
        this.target.y = y;
        this.target.z = z;
        this.updateCameraPosition();
    }

    /**
     * Cleanup
     */
    dispose() {
        this.canvas.removeEventListener('mousedown', this.onMouseDown);
        this.canvas.removeEventListener('mousemove', this.onMouseMove);
        this.canvas.removeEventListener('mouseup', this.onMouseUp);
        this.canvas.removeEventListener('mouseleave', this.onMouseUp);
        this.canvas.removeEventListener('wheel', this.onWheel);
        this.canvas.removeEventListener('touchstart', this.onTouchStart);
        this.canvas.removeEventListener('touchmove', this.onTouchMove);
        this.canvas.removeEventListener('touchend', this.onMouseUp);
    }

    // ========================================
    // NEW: Smooth Camera Transition System
    // ========================================

    /**
     * Linear interpolation helper
     */
    lerp(start, end, t) {
        return start + (end - start) * t;
    }

    /**
     * Smoothly transition camera to a preset
     * @param {string} presetName - Name of preset (behind, sideOff, sideLeg, closeUp, wide)
     * @param {number} duration - Animation duration in ms (default 800)
     */
    transitionTo(presetName, duration = 800) {
        const preset = this.presets[presetName];
        if (!preset) {
            console.warn(`Camera preset '${presetName}' not found`);
            return;
        }

        // Store starting state
        this.startState = {
            radius: this.spherical.radius,
            theta: this.spherical.theta,
            phi: this.spherical.phi,
            target: { ...this.target }
        };

        // Store target state
        this.targetState = preset;
        this.animationDuration = duration;
        this.animationStartTime = Date.now();
        this.isAnimating = true;

        console.log(`📷 Camera: transitioning to '${presetName}' over ${duration}ms`);
    }

    /**
     * Update animation - call this every frame
     */
    update() {
        if (!this.isAnimating || !this.startState || !this.targetState) {
            return;
        }

        const elapsed = Date.now() - this.animationStartTime;
        const rawT = Math.min(elapsed / this.animationDuration, 1);

        // Ease-out cubic for smooth deceleration
        const t = 1 - Math.pow(1 - rawT, 3);

        // Interpolate spherical coordinates
        this.spherical.radius = this.lerp(this.startState.radius, this.targetState.radius, t);
        this.spherical.theta = this.lerp(this.startState.theta, this.targetState.theta, t);
        this.spherical.phi = this.lerp(this.startState.phi, this.targetState.phi, t);

        // Interpolate target (look-at point)
        if (this.targetState.target) {
            this.target.x = this.lerp(this.startState.target.x, this.targetState.target.x, t);
            this.target.y = this.lerp(this.startState.target.y, this.targetState.target.y, t);
            this.target.z = this.lerp(this.startState.target.z, this.targetState.target.z, t);
        }

        // Update camera position
        this.updateCameraPosition();

        // Check if animation complete
        if (rawT >= 1) {
            this.isAnimating = false;
            console.log('📷 Camera transition complete');
        }
    }

    /**
     * Smoothly follow a target (like ball position)
     */
    followTarget(targetPosition, smoothness = 0.05) {
        if (this.isAnimating) return; // Don't interrupt transitions

        this.target.x = this.lerp(this.target.x, targetPosition.x, smoothness);
        this.target.y = this.lerp(this.target.y, targetPosition.y, smoothness);
        this.target.z = this.lerp(this.target.z, targetPosition.z, smoothness);

        this.updateCameraPosition();
    }

    /**
     * Zoom out to track ball after hit - follows ball direction
     * @param {Object} ballDirection - Direction ball is traveling {x, y, z}
     */
    zoomOutForBallTracking(ballDirection = null) {
        // Create a dynamic preset based on ball direction
        let theta = 0; // Default: behind
        let targetZ = 30;
        let targetX = 0;

        if (ballDirection) {
            // Calculate camera angle based on ball direction
            // Ball going left (off side) → camera on right to see it
            // Ball going right (leg side) → camera on left to see it
            if (ballDirection.x < -0.3) {
                // Off side shot → camera from leg side to see ball go to off
                theta = -Math.PI / 4; // 45° towards leg side
                targetX = ballDirection.x * 15; // Follow ball X direction
            } else if (ballDirection.x > 0.3) {
                // Leg side shot → camera from off side to see ball go to leg
                theta = Math.PI / 4; // 45° towards off side
                targetX = ballDirection.x * 15;
            } else {
                // Straight shot → slight side angle to see ball travel down ground
                theta = Math.PI / 12; // 15° slight offset for better trajectory view
                targetX = 0;
            }

            // Target should be where ball is heading
            targetZ = 30 + Math.max(0, ballDirection.z * 20);
        }

        // Create dynamic zoom out state
        const dynamicWide = {
            radius: 80,
            theta: theta,
            phi: Math.PI / 3.5, // Higher angle to see ball trajectory
            target: { x: targetX, y: 2, z: targetZ }
        };

        // Store and animate to dynamic position
        this.startState = {
            radius: this.spherical.radius,
            theta: this.spherical.theta,
            phi: this.spherical.phi,
            target: { ...this.target }
        };

        this.targetState = dynamicWide;
        this.animationDuration = 600;
        this.animationStartTime = Date.now();
        this.isAnimating = true;

        console.log(`📷 Camera: zooming out to follow ball (θ=${(theta * 180 / Math.PI).toFixed(0)}°)`);
    }

    /**
     * Zoom in for next delivery
     */
    zoomInForBatting() {
        this.transitionTo('closeUp', 800);
    }

    /**
     * Check if currently animating
     */
    isTransitioning() {
        return this.isAnimating;
    }
}

