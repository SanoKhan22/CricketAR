/**
 * Renderer Module - Three.js scene setup
 * Enhanced with better camera views and field circles
 */

import * as THREE from 'three';
import { CameraControls } from './cameraControls.js?v=82';
import { StadiumLights } from './stadiumLights.js';
import { StadiumEnvironment } from './stadiumEnvironment.js';

export class Renderer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.canvas = null;
        this.controls = null; // Camera controls

        // Scene objects
        this.field = null;
        this.pitch = null;
        this.wickets = [];
        this.ball = null;
        this.ballTrail = [];
        this.innerCircle = null;
        this.outerCircle = null;

        // Lighting
        this.ambientLight = null;
        this.sunLight = null;
        this.stadiumLights = null;

        // Environment
        this.stadiumEnvironment = null;

        // Camera states
        this.cameraMode = 'pitch'; // 'pitch', 'inner', 'full'
        this.targetCameraPos = { x: 0, y: 15, z: 25 };
        this.useInteractiveCamera = true; // Toggle for interactive vs automatic camera

        // Animation
        this.animationId = null;
        this.isRunning = false;
    }

    /**
     * Initialize Three.js scene
     */
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);

        if (!this.canvas) {
            throw new Error(`Canvas element with id "${canvasId}" not found`);
        }

        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1a3320); // Darker green

        // Create camera - closer view for pitch
        const aspect = this.canvas.clientWidth / this.canvas.clientHeight;
        this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 500);

        // IMPORTANT: Set initial camera position explicitly
        // This must be done BEFORE controls initialize
        this.camera.position.set(0, 25, 40);
        this.camera.lookAt(0, 0, 0);

        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);

        // Add lights
        this.addLights();

        // Create cricket field with circles
        this.createField();

        // Create stadium environment (seating, boundary, etc.)
        this.stadiumEnvironment = new StadiumEnvironment(this.scene);
        this.stadiumEnvironment.create();

        // Initialize camera controls AFTER camera is positioned
        // The controls will take over from this position
        this.controls = new CameraControls(this.camera, this.canvas);
        // Sync controls with current camera position
        this.controls.setView(40, 0, Math.PI / 3);

        // Set camera mode for automatic camera (used when interactive mode is disabled)
        this.setCameraMode('pitch');

        // Handle resize
        window.addEventListener('resize', () => this.onResize());

        console.log('Renderer initialized with interactive camera controls');
        return this;
    }

    /**
     * Add lighting to scene - Day mode with optional stadium lights
     */
    addLights() {
        // Ambient light (day mode - bright)
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(this.ambientLight);

        // Directional light (sun)
        this.sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
        this.sunLight.position.set(50, 100, 50);
        this.scene.add(this.sunLight);

        // Hemisphere light for natural outdoor lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemiLight.position.set(0, 50, 0);
        this.scene.add(hemiLight);

        // Create stadium lights (initially off)
        this.stadiumLights = new StadiumLights(this.scene);
        this.stadiumLights.create();

        console.log('💡 Day mode active. Stadium lights OFF.');
    }

    /**
     * Toggle stadium lights (day/night mode)
     */
    toggleStadiumLights() {
        if (!this.stadiumLights) return false;

        const isNight = this.stadiumLights.toggle();

        if (isNight) {
            // Night mode - darker ambient, darker background
            this.ambientLight.intensity = 0.15;
            this.sunLight.intensity = 0;
            this.scene.background = new THREE.Color(0x0a1520); // Dark blue night sky
            console.log('🌙 Night mode: Stadium lights ON');
        } else {
            // Day mode - brighter ambient, green background
            this.ambientLight.intensity = 0.7;
            this.sunLight.intensity = 0.9;
            this.scene.background = new THREE.Color(0x1a3320); // Green day sky
            console.log('☀️ Day mode: Stadium lights OFF');
        }

        return isNight;
    }

    /**
     * Create cricket field with inner and outer circles
     */
    createField() {
        // Full ground (65m radius = ~70 yards boundary)
        const groundGeometry = new THREE.CircleGeometry(65, 64);
        const groundMaterial = new THREE.MeshLambertMaterial({
            color: 0x2d5a27,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = 0;
        this.scene.add(ground);

        // Inner circle (30 yards = ~27.4m) - positioned BELOW the pitch
        this.createCircle(27.4, 0.01, 0x3d7a37, 'innerCircle');

        // 30-yard circle line (white)
        this.createCircleLine(27.4, 0xffffff, 0.3);

        // Boundary line (65m)
        this.createCircleLine(65, 0xffffff, 0.5);

        // Pitch (brown strip between wickets) - must be ABOVE the circles
        this.createPitch();

        // Create wickets at both ends
        this.createWickets();
    }

    /**
     * Create a colored circle (filled)
     */
    createCircle(radius, yPos, color, name) {
        const geometry = new THREE.CircleGeometry(radius, 64);
        const material = new THREE.MeshLambertMaterial({
            color: color,
            side: THREE.DoubleSide
        });
        const circle = new THREE.Mesh(geometry, material);
        circle.rotation.x = -Math.PI / 2;
        circle.position.y = yPos;
        circle.name = name;
        this.scene.add(circle);

        if (name === 'innerCircle') this.innerCircle = circle;
    }

    /**
     * Create a circle outline
     */
    createCircleLine(radius, color, lineWidth) {
        const points = [];
        const segments = 64;
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * Math.PI * 2;
            points.push(new THREE.Vector3(
                Math.cos(theta) * radius,
                0.1,
                Math.sin(theta) * radius
            ));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: color, linewidth: lineWidth });
        const line = new THREE.Line(geometry, material);
        this.scene.add(line);
    }

    /**
     * Create cricket pitch - the BROWN strip where ball bounces
     * This is the rectangular brown area between the two wickets
     * Using BoxGeometry for guaranteed visibility above the green grass
     */
    createPitch() {
        // Main pitch strip - raised HIGH above ground for visibility
        // Ground is at y=0, inner circle at y=0.01, pitch at y=0.5
        const pitchGeometry = new THREE.BoxGeometry(6, 0.3, 24); // width, height, length
        const pitchMaterial = new THREE.MeshLambertMaterial({
            color: 0xc9a86c // Sandy brown - matches reference image
        });
        this.pitch = new THREE.Mesh(pitchGeometry, pitchMaterial);
        this.pitch.position.set(0, 0.15, 0); // Centered, raised 0.15 above ground
        this.scene.add(this.pitch);

        console.log('PITCH created at y=0.15, color=#c9a86c');

        // Darker worn center area where ball bounces most
        const wornAreaGeometry = new THREE.BoxGeometry(5, 0.32, 16);
        const wornAreaMaterial = new THREE.MeshLambertMaterial({
            color: 0xb5915a // Slightly darker tan/brown
        });
        const wornArea = new THREE.Mesh(wornAreaGeometry, wornAreaMaterial);
        wornArea.position.set(0, 0.16, -1); // Slightly above main pitch
        this.scene.add(wornArea);

        // White pitch boundary outline
        this.createPitchOutline();

        // Crease markings (white lines)
        this.createCreaseLines();

        console.log('Pitch created: brown rectangle between wickets');
    }

    /**
     * Create white pitch boundary outline
     */
    createPitchOutline() {
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });

        // Outer boundary of pitch
        const outlinePoints = [
            new THREE.Vector3(-2.5, 0.05, -12),
            new THREE.Vector3(2.5, 0.05, -12),
            new THREE.Vector3(2.5, 0.05, 12),
            new THREE.Vector3(-2.5, 0.05, 12),
            new THREE.Vector3(-2.5, 0.05, -12)
        ];
        const outlineGeo = new THREE.BufferGeometry().setFromPoints(outlinePoints);
        this.scene.add(new THREE.Line(outlineGeo, lineMaterial));
    }

    /**
     * Create accurate crease lines based on cricket rules
     * - Bowling crease: at wicket line
     * - Popping crease: 4 ft (1.22m) in front of bowling crease
     * - Return creases: 4 ft (1.22m) on each side of center
     */
    createCreaseLines() {
        const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 3 });

        // === BATTING END (near camera, z = 10) ===

        // Bowling crease (where stumps are) - 8.66 ft wide = 2.64m
        this.scene.add(this.createLine(-1.5, 10, 1.5, 10, lineMaterial));

        // Popping crease (4 ft = 1.22m in front)
        this.scene.add(this.createLine(-2, 11.2, 2, 11.2, lineMaterial));

        // Return creases (vertical lines, 4ft from center each side)
        this.scene.add(this.createLine(-1.5, 10, -1.5, 12, lineMaterial));
        this.scene.add(this.createLine(1.5, 10, 1.5, 12, lineMaterial));
        // Extended return creases past popping crease
        this.scene.add(this.createLine(-2, 11.2, -2, 12, lineMaterial));
        this.scene.add(this.createLine(2, 11.2, 2, 12, lineMaterial));

        // === BOWLING END (far from camera, z = -10) ===

        // Bowling crease
        this.scene.add(this.createLine(-1.5, -10, 1.5, -10, lineMaterial));

        // Popping crease
        this.scene.add(this.createLine(-2, -11.2, 2, -11.2, lineMaterial));

        // Return creases
        this.scene.add(this.createLine(-1.5, -10, -1.5, -12, lineMaterial));
        this.scene.add(this.createLine(1.5, -10, 1.5, -12, lineMaterial));
        this.scene.add(this.createLine(-2, -11.2, -2, -12, lineMaterial));
        this.scene.add(this.createLine(2, -11.2, 2, -12, lineMaterial));
    }

    /**
     * Helper to create a line
     */
    createLine(x1, z1, x2, z2, material) {
        const points = [
            new THREE.Vector3(x1, 0.08, z1),
            new THREE.Vector3(x2, 0.08, z2)
        ];
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.Line(geometry, material);
    }

    /**
     * Create wickets - MUCH larger for visibility, batting end bigger
     */
    createWickets() {
        // Batting end wicket (closer to camera = much bigger)
        this.createWicketSet(10, 'batting', 3.0); // 3x scale

        // Bowling end wicket (far away = smaller but still visible)
        this.createWicketSet(-10, 'bowling', 1.5); // 1.5x scale
    }

    /**
     * Create a set of wickets with given scale - colors match reference image
     */
    createWicketSet(zPosition, name, scale) {
        // Stump colors - reddish-orange like reference image
        const stumpMaterial = new THREE.MeshLambertMaterial({ color: 0xcd5c3c }); // Reddish-brown
        // Bail colors - cream/light colored
        const bailMaterial = new THREE.MeshLambertMaterial({ color: 0xf5e6c8 }); // Cream

        const wicketGroup = new THREE.Group();
        wicketGroup.name = name + 'Wicket';

        // Stump dimensions (scaled)
        const stumpRadius = 0.12 * scale;
        const stumpHeight = 1.5 * scale;
        const stumpSpacing = 0.25 * scale;

        // Three stumps
        for (let i = -1; i <= 1; i++) {
            const stumpGeometry = new THREE.CylinderGeometry(stumpRadius, stumpRadius, stumpHeight, 12);
            const stump = new THREE.Mesh(stumpGeometry, stumpMaterial);
            stump.position.set(i * stumpSpacing, stumpHeight / 2, 0);
            wicketGroup.add(stump);
        }

        // Two bails on top
        const bailRadius = 0.05 * scale;
        const bailLength = 0.3 * scale;
        for (let i = 0; i <= 1; i++) {
            const bailGeometry = new THREE.CylinderGeometry(bailRadius, bailRadius, bailLength, 8);
            const bail = new THREE.Mesh(bailGeometry, bailMaterial);
            bail.rotation.z = Math.PI / 2;
            bail.position.set((i - 0.5) * stumpSpacing, stumpHeight + bailRadius * 2, 0);
            wicketGroup.add(bail);
        }

        // Add a base plate for better visibility
        const baseGeometry = new THREE.BoxGeometry(stumpSpacing * 3, 0.1, 0.3 * scale);
        const baseMaterial = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
        const base = new THREE.Mesh(baseGeometry, baseMaterial);
        base.position.y = 0.05;
        wicketGroup.add(base);

        wicketGroup.position.z = zPosition;
        this.scene.add(wicketGroup);
        this.wickets.push(wicketGroup);
    }

    /**
     * Create or get cricket ball - larger
     */
    createBall() {
        if (this.ball) {
            return this.ball;
        }

        // Cricket ball (red sphere with seam) - bright and visible
        const ballGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const ballMaterial = new THREE.MeshStandardMaterial({
            color: 0xff0000,  // Bright red
            emissive: 0x440000,  // Slight glow
            roughness: 0.5,
            metalness: 0.1
        });
        this.ball = new THREE.Mesh(ballGeometry, ballMaterial);

        // Add seam
        const seamGeometry = new THREE.TorusGeometry(0.5, 0.03, 8, 32);
        const seamMaterial = new THREE.MeshBasicMaterial({ color: 0xfef3c7 });
        const seam = new THREE.Mesh(seamGeometry, seamMaterial);
        seam.rotation.x = Math.PI / 2;
        this.ball.add(seam);

        this.ball.visible = false;
        this.ball.name = 'cricketBall';
        this.scene.add(this.ball);

        console.log('🏐 Ball created and added to scene');

        return this.ball;
    }

    /**
     * Set camera mode
     */
    setCameraMode(mode) {
        this.cameraMode = mode;

        switch (mode) {
            case 'pitch':
                // Close-up view of pitch during bowling
                this.targetCameraPos = { x: 0, y: 12, z: 22 };
                break;
            case 'inner':
                // Show inner 30-yard circle
                this.targetCameraPos = { x: 0, y: 35, z: 40 };
                break;
            case 'full':
                // Full ground view for boundaries
                this.targetCameraPos = { x: 0, y: 80, z: 60 };
                break;
        }
    }

    /**
     * Smooth camera transition (only when not using interactive controls)
     */
    updateCamera() {
        // Skip automatic camera updates if using interactive controls
        if (this.useInteractiveCamera) {
            return;
        }

        const speed = 0.05;
        this.camera.position.x += (this.targetCameraPos.x - this.camera.position.x) * speed;
        this.camera.position.y += (this.targetCameraPos.y - this.camera.position.y) * speed;
        this.camera.position.z += (this.targetCameraPos.z - this.camera.position.z) * speed;
        this.camera.lookAt(0, 0, 0);
    }

    /**
     * Update ball position
     */
    updateBallPosition(x, y, z) {
        if (!this.ball) {
            this.createBall();
        }

        this.ball.visible = true;
        this.ball.position.set(x, y, z);

        // Debug: Log ball position occasionally
        if (Math.random() < 0.05) { // 5% chance
            console.log(`🏐 Ball position: (${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}), visible: ${this.ball.visible}`);
        }

        // Rotate ball for visual effect
        this.ball.rotation.x += 0.15;
        this.ball.rotation.z += 0.08;
    }

    /**
     * Hide ball
     */
    hideBall() {
        if (this.ball) {
            this.ball.visible = false;
        }
    }

    /**
     * Add ball trail point - creates dotted trajectory
     */
    addTrailPoint(x, y, z) {
        // Store position for trajectory line
        if (!this.trajectoryPoints) {
            this.trajectoryPoints = [];
        }

        this.trajectoryPoints.push(new THREE.Vector3(x, y, z));

        // Create small dot at this point
        const dotGeometry = new THREE.SphereGeometry(0.15, 6, 6);
        const dotMaterial = new THREE.MeshBasicMaterial({
            color: 0xffcc00, // Yellow dots
            transparent: true,
            opacity: 0.9
        });
        const dot = new THREE.Mesh(dotGeometry, dotMaterial);
        dot.position.set(x, y, z);
        this.scene.add(dot);
        this.ballTrail.push(dot);

        // Update trajectory line
        this.updateTrajectoryLine();

        // Limit trail length
        if (this.ballTrail.length > 80) {
            const oldDot = this.ballTrail.shift();
            this.scene.remove(oldDot);
            this.trajectoryPoints.shift();
        }
    }

    /**
     * Update the dotted trajectory line
     */
    updateTrajectoryLine() {
        // Remove old line
        if (this.trajectoryLine) {
            this.scene.remove(this.trajectoryLine);
        }

        if (!this.trajectoryPoints || this.trajectoryPoints.length < 2) return;

        // Create dashed line material
        const lineMaterial = new THREE.LineDashedMaterial({
            color: 0xff4444,
            dashSize: 0.5,
            gapSize: 0.3,
            linewidth: 2
        });

        // Create line geometry from points
        const lineGeometry = new THREE.BufferGeometry().setFromPoints(this.trajectoryPoints);
        this.trajectoryLine = new THREE.Line(lineGeometry, lineMaterial);
        this.trajectoryLine.computeLineDistances(); // Required for dashed lines
        this.scene.add(this.trajectoryLine);
    }

    /**
     * Clear ball trail and trajectory
     */
    clearTrail() {
        // Remove all dots
        for (const point of this.ballTrail) {
            this.scene.remove(point);
        }
        this.ballTrail = [];

        // Remove trajectory line
        if (this.trajectoryLine) {
            this.scene.remove(this.trajectoryLine);
            this.trajectoryLine = null;
        }
        this.trajectoryPoints = [];
    }

    /**
     * Follow ball with camera - auto zoom based on distance
     */
    followBall(ballPosition) {
        if (!ballPosition) return;

        const distance = Math.sqrt(ballPosition.x ** 2 + ballPosition.z ** 2);

        // Auto-switch camera based on ball distance
        if (distance > 50) {
            this.setCameraMode('full');
        } else if (distance > 25) {
            this.setCameraMode('inner');
        }

        // Adjust target to follow ball direction
        this.targetCameraPos.x = ballPosition.x * 0.2;
    }

    /**
     * Reset camera position
     */
    resetCamera() {
        this.setCameraMode('pitch');
    }

    /**
     * Start render loop
     */
    start(onUpdate) {
        this.isRunning = true;

        const animate = () => {
            if (!this.isRunning) return;

            this.animationId = requestAnimationFrame(animate);
            this.updateCamera();

            if (onUpdate) {
                onUpdate();
            }

            this.renderer.render(this.scene, this.camera);
        };

        animate();
    }

    /**
     * Stop render loop
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }

    /**
     * Handle window resize
     */
    onResize() {
        if (!this.canvas) return;

        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    /**
     * Render single frame
     */
    render() {
        // Debug: Log camera and scene info once
        if (!this._debugLogged) {
            console.log('📷 Camera position:', this.camera.position);
            console.log('📷 Camera looking at: (0, 0, 0)');
            console.log('🎬 Scene children:', this.scene.children.length);
            console.log('🎬 Scene children:', this.scene.children.map(c => c.name || c.type));
            this._debugLogged = true;
        }

        this.updateCamera();
        this.renderer.render(this.scene, this.camera);
    }

    /**
     * Toggle between interactive and automatic camera
     */
    setInteractiveCamera(enabled) {
        this.useInteractiveCamera = enabled;
        if (this.controls) {
            this.controls.setEnabled(enabled);
        }
        console.log(`Camera mode: ${enabled ? 'Interactive' : 'Automatic'}`);
    }

    /**
     * Reset camera to default view
     */
    resetCameraView() {
        if (this.controls) {
            this.controls.reset();
        }
    }

    /**
     * Cleanup
     */
    dispose() {
        if (this.controls) {
            this.controls.dispose();
        }
    }
}
