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
        this.target = { x: 0, y: 0, z: 0 };

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
}
