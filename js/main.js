import * as THREE from 'three';
/**
 * Cricket AR - Main Game Module
 * Integrates all components for the cricket batting game
 */

import { Camera } from './camera.js?v=63';
import { HandTracking } from './handTracking.js?v=63';
import { Renderer } from './renderer.js?v=63';
import { Physics } from './physics.js?v=63';
import { Bowling } from './bowling.js?v=63';
import { Batting } from './batting.js?v=63';
import { Bat } from './bat.js?v=63'; // 3D cricket bat with zone detection
import { UI } from './ui.js?v=63';
import { ShotStateMachine } from './shotStateMachine.js?v=63';
import { TimingSystem } from './timingSystem.js?v=63';

class CricketARGame {
    constructor() {
        // Modules
        this.camera = new Camera();
        this.handTracking = new HandTracking();
        this.renderer = new Renderer();
        this.physics = new Physics();
        this.bowling = new Bowling();
        this.batting = new Batting();
        this.bat = new Bat(); // 3D bat with zones
        this.ui = new UI();

        // === NEW: Realistic batting systems ===
        this.shotStateMachine = new ShotStateMachine();
        this.timingSystem = new TimingSystem();

        // Game state
        this.state = 'idle'; // idle, bowling, batting, result
        this.isRunning = false;
        this.lastTime = 0;

        // Score
        this.totalRuns = 0;
        this.totalBalls = 0;

        // Camera dimensions
        this.cameraWidth = 0;
        this.cameraHeight = 0;

        // Performance tracking
        this.frameCount = 0;
        this.fps = 0;
        this.lastFpsUpdate = 0;

        // Hit detection
        this.hasHitThisDelivery = false;

        // Design decisions (for reference)
        this.config = {
            targetFPS: 30,
            bounceCoefficient: 0.6,
            swingThreshold: 1.5,
            hitZoneZ: { min: 6, max: 10 }, // Extended for front foot play
            hitZoneY: { min: 0.3, max: 3.5 } // Extended for bouncers
        };

        // Set up shot state machine callbacks
        this.shotStateMachine.onDownswingStart = () => {
            this.timingSystem.onDownswingStart();
        };
    }

    /**
     * Initialize all game components
     */
    async init() {
        try {
            this.ui.init();
            this.ui.setLoadingStatus('Initializing camera...');

            // Initialize camera
            await this.camera.init('camera-feed');
            const dimensions = await this.camera.start();
            this.cameraWidth = dimensions.width;
            this.cameraHeight = dimensions.height;

            // Set up overlay canvas
            this.setupOverlayCanvas();

            this.ui.setLoadingStatus('Loading hand tracking...');

            // Initialize hand tracking
            await this.handTracking.init();
            this.handTracking.onResults((results) => this.onHandResults(results));
            await this.handTracking.start(this.camera.getVideoElement());

            // Always enable keyboard/click controls for hitting (works in both modes)
            this.setupHitControls();

            this.ui.setLoadingStatus('Setting up 3D field...');

            // Initialize renderer
            this.renderer.init('field-canvas');
            this.renderer.createBall();

            // Create 3D cricket bat
            this.bat.create(this.renderer.scene);
            console.log('🏏 3D Cricket bat with zone detection initialized');

            // Initialize physics
            this.physics.init();

            this.ui.setLoadingStatus('Ready!');

            // Set up UI callbacks
            this.ui.setCallbacks(
                () => this.bowl(),
                () => this.randomBowl()
            );

            // Hide loading screen
            setTimeout(() => {
                this.ui.hideLoading();
            }, 500);

            // Start game loop
            this.start();

            console.log('Cricket AR Game initialized');

        } catch (error) {
            console.error('Failed to initialize game:', error);
            this.ui.setLoadingStatus(`Error: ${error.message}`);
        }
    }

    /**
     * Setup keyboard/click controls for hitting - works in both modes
     */
    setupHitControls() {
        // Track key states for directional shots
        this.shotDirection = { x: 0, y: 0.5, z: 1 };

        document.addEventListener('keydown', (e) => {
            // Arrow keys set shot direction
            if (e.code === 'ArrowLeft') {
                this.shotDirection.x = 1.5; // Offside
                e.preventDefault();
            }
            if (e.code === 'ArrowRight') {
                this.shotDirection.x = -1.5; // Onside  
                e.preventDefault();
            }
            if (e.code === 'ArrowUp') {
                this.shotDirection.y = 1; // Lofted
                e.preventDefault();
            }
            if (e.code === 'ArrowDown') {
                this.shotDirection.y = 0.2; // Grounded
                e.preventDefault();
            }

            // Space to hit
            if (e.code === 'Space' && this.state === 'batting' && !this.hasHitThisDelivery) {
                e.preventDefault();
                this.executeHit();
            }
        });

        document.addEventListener('keyup', (e) => {
            // Reset direction on key release
            if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
                this.shotDirection.x = 0;
            }
            if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
                this.shotDirection.y = 0.5;
            }
        });

        // Click/touch to hit
        document.getElementById('camera-panel').addEventListener('click', (e) => {
            if (this.state === 'batting' && !this.hasHitThisDelivery) {
                // Determine direction from click position
                const rect = e.currentTarget.getBoundingClientRect();
                const x = (e.clientX - rect.left) / rect.width;
                const y = (e.clientY - rect.top) / rect.height;

                // Left click = offside, right = onside
                this.shotDirection.x = (x - 0.5) * -3;
                // Top = lofted, bottom = grounded
                this.shotDirection.y = 1 - y;
            }
        });

        // Visual guide toggles
        document.getElementById('show-shadow').addEventListener('change', (e) => {
            this.bat.setShadowVisible(e.target.checked);
        });

        document.getElementById('show-zone').addEventListener('change', (e) => {
            this.bat.setCollisionZoneVisible(e.target.checked);
        });

        document.getElementById('show-grip').addEventListener('change', (e) => {
            this.bat.setGripIndicatorVisible(e.target.checked);
        });

        document.getElementById('show-trail').addEventListener('change', (e) => {
            this.bat.setTrailVisible(e.target.checked);
        });

        console.log('Hit controls initialized: SPACE to hit, Arrow keys for direction');
    }

    /**
     * Execute a hit with current direction - uses authentic cricket shots
     */
    executeHit() {
        if (!this.physics.isInHittingZone()) {
            console.log('Ball not in hitting zone yet... (wait for it!)');
            this.ui.showShotResult('Too early!');
            return;
        }

        this.hasHitThisDelivery = true;

        // Get shot based on direction using cricket shot system
        const dir = this.shotDirection;
        const speed = Math.sqrt(dir.x ** 2 + dir.y ** 2);

        // Map direction to authentic cricket shot
        let shotData = this.getAuthenticShot(dir, speed);

        // Apply hit with shot power
        const power = 0.5 + Math.random() * 0.5 * shotData.power;
        this.physics.hit(shotData.direction, power);

        // Display shot name with clock position
        const clockInfo = `${shotData.name} (${shotData.clockPosition} o'clock)`;
        this.ui.showShotResult(shotData.name);

        // Show impact effect
        const camPanel = document.getElementById('camera-panel');
        this.ui.showImpactEffect(camPanel.clientWidth / 2, camPanel.clientHeight / 2);

        console.log('🏏 HIT!', clockInfo, 'Direction:', shotData.direction, 'Power:', power.toFixed(2));
    }

    /**
     * Get authentic cricket shot based on input direction
     */
    getAuthenticShot(dir, speed) {
        // Shots from batting.js mapped to input direction
        const shots = {
            // Off-side shots (positive x = right side)
            'square-cut': { name: 'Square Cut', clockPosition: 3, direction: { x: 1.5, y: 0.3, z: 0.2 }, power: 0.85 },
            'cover-drive': { name: 'Cover Drive', clockPosition: 1.5, direction: { x: 0.8, y: 0.5, z: 1.2 }, power: 0.9 },
            'late-cut': { name: 'Late Cut', clockPosition: 4.5, direction: { x: 1.2, y: 0.2, z: -0.3 }, power: 0.6 },

            // Straight shots
            'straight-drive': { name: 'Straight Drive', clockPosition: 12, direction: { x: 0, y: 0.6, z: 1.5 }, power: 0.95 },
            'forward-defensive': { name: 'Forward Defensive', clockPosition: 12, direction: { x: 0, y: 0.1, z: 0.2 }, power: 0.15 },

            // Leg-side shots (negative x = left side)
            'on-drive': { name: 'On Drive', clockPosition: 10.5, direction: { x: -0.5, y: 0.5, z: 1.2 }, power: 0.9 },
            'pull-shot': { name: 'Pull Shot', clockPosition: 8.5, direction: { x: -1.5, y: 0.4, z: 0.3 }, power: 0.95 },
            'flick': { name: 'Flick', clockPosition: 9, direction: { x: -1, y: 0.4, z: 0.8 }, power: 0.75 }
        };

        // Determine shot based on direction
        if (speed < 0.5) {
            return shots['forward-defensive'];
        }

        if (dir.x > 0.8) {
            // Strong off-side
            return dir.y > 0.5 ? shots['cover-drive'] : shots['square-cut'];
        } else if (dir.x > 0.3) {
            // Moderate off-side
            return dir.y < 0.3 ? shots['late-cut'] : shots['cover-drive'];
        } else if (dir.x < -0.8) {
            // Strong leg-side
            return dir.y > 0.5 ? shots['on-drive'] : shots['pull-shot'];
        } else if (dir.x < -0.3) {
            // Moderate leg-side
            return shots['flick'];
        } else {
            // Straight
            return dir.y > 0.6 ? shots['straight-drive'] : shots['forward-defensive'];
        }
    }

    /**
     * Simulate a hit (legacy - now calls executeHit)
     */
    simulateHit() {
        // Set random direction and hit
        this.shotDirection = {
            x: (Math.random() - 0.5) * 3,
            y: 0.3 + Math.random() * 0.7,
            z: 1
        };
        this.executeHit();
    }



    /**
     * Set up overlay canvas dimensions
     */
    setupOverlayCanvas() {
        const overlay = document.getElementById('camera-overlay');
        const container = document.getElementById('camera-panel');

        overlay.width = container.clientWidth;
        overlay.height = container.clientHeight;

        window.addEventListener('resize', () => {
            overlay.width = container.clientWidth;
            overlay.height = container.clientHeight;
        });
    }

    /**
     * Handle hand tracking results - moves 3D bat and checks zones
     */
    onHandResults(results) {
        const hasHands = results.hands.length > 0;
        this.ui.setHandStatus(hasHands);

        if (hasHands) {
            const landmarks = results.hands[0]; // First hand, all 21 landmarks

            // Update batting with full landmarks (all 5 fingers as bat)
            this.batting.updateWithLandmarks(landmarks);

            // Also update with palm position and velocity for compatibility
            const palmPosition = this.handTracking.getPalmPosition();
            this.batting.updateHandPosition(palmPosition, results.velocity);

            // UPDATE 3D BAT POSITION AND ROTATION from hand landmarks
            // This makes the bat angle match your hand angle!
            if (this.bat && landmarks) {
                this.bat.updateFromLandmarks(landmarks, results.velocity);
            }

            // Draw hands on overlay
            const overlay = document.getElementById('camera-overlay');
            const ctx = overlay.getContext('2d');
            this.handTracking.drawHands(ctx, overlay.width, overlay.height);

            // Draw hand bounding box (visual feedback for bat area)
            this.drawHandBatArea(ctx, overlay.width, overlay.height);

            // Check for hit using 3D BAT COLLISION with zones
            if (this.state === 'batting' && !this.hasHitThisDelivery) {
                this.checkForBatHit();
            }

            // Show swing indicator
            const swingData = this.batting.getSwingData();
            if (swingData.isSwinging) {
                this.ui.setHandStatus(true, `Swinging! (${swingData.direction})`);
            }
        }
    }

    /**
     * Draw hand bat area on overlay
     */
    drawHandBatArea(ctx, width, height) {
        const bounds = this.batting.handBounds;
        if (!bounds) return;

        // Convert normalized coords to pixels
        const x = bounds.minX * width;
        const y = bounds.minY * height;
        const w = bounds.width * width;
        const h = bounds.height * height;

        // Draw bat area
        ctx.strokeStyle = this.batting.isSwinging ? '#22c55e' : '#00d4aa';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // If swinging, fill with transparent color
        if (this.batting.isSwinging) {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.2)';
            ctx.fillRect(x, y, w, h);
        }

        // Draw visual guides (doesn't block collision)
        this.drawBattingGuides(ctx, width, height);
    }

    /**
     * Draw batting zone and ball position guide on camera
     * VISUAL ONLY - does not affect collision detection
     * Ball travels from TOP of screen (bowler) to BATTING AREA (you)
     */
    drawBattingGuides(ctx, width, height) {
        // === BATTING ZONE BOX ===
        // This is where your hand should be and where ball will arrive
        const zoneX = width * 0.2;
        const zoneY = height * 0.30;  // Higher on screen (30% from top)
        const zoneW = width * 0.6;
        const zoneH = height * 0.55;  // Taller zone

        // Draw batting zone
        ctx.strokeStyle = 'rgba(0, 200, 255, 0.5)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]);
        ctx.strokeRect(zoneX, zoneY, zoneW, zoneH);
        ctx.setLineDash([]);

        // Label
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = 'rgba(0, 200, 255, 0.7)';
        ctx.fillText('BATTING AREA', zoneX + 5, zoneY - 5);

        // === BALL POSITION INDICATOR ===
        // Ball starts at TOP (Z=0) and comes DOWN to batting area (Z=10)
        if (this.state === 'bowling' || this.state === 'batting') {
            const ballPos = this.physics.getBallPosition();

            // Progress: 0 = bowler end (top), 1 = hitting zone (in batting area)
            const zProgress = Math.max(0, Math.min(1, ballPos.z / 10));

            // Ball Y: starts at top (0.0), ends DEEP in batting area (0.70)
            const ballCamY = (0.0 + zProgress * 0.70) * height;

            // Ball X: centered, but shifts based on line
            // Map 3D X (-3 to +3) to screen X, keeping it within batting area
            const centerX = width * 0.5;
            const ballCamX = centerX - (ballPos.x / 5) * zoneW * 0.4;

            // Ball size: small when far (top), big when close (batting area)
            const radius = Math.max(5, 10 + zProgress * 25);

            // Ball height (3D Y) affects vertical position slightly
            // High ball = slightly higher in camera, low ball = slightly lower
            const heightOffset = (1.5 - ballPos.y) * 30 * zProgress;
            const finalBallY = ballCamY + heightOffset;

            // Draw ball indicator
            const inHittingZone = this.physics.isInHittingZone();
            ctx.beginPath();
            ctx.arc(ballCamX, finalBallY, radius, 0, Math.PI * 2);

            if (inHittingZone) {
                // BIG RED BALL - swing at this!
                ctx.fillStyle = 'rgba(255, 30, 30, 0.9)';
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 4;
                ctx.stroke();

                // "HIT IT!" text
                ctx.font = 'bold 18px Arial';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.fillText('⚾ HIT IT!', ballCamX, finalBallY - radius - 8);
                ctx.textAlign = 'left';
            } else {
                // Approaching ball - orange
                ctx.fillStyle = 'rgba(255, 150, 50, 0.7)';
                ctx.fill();
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // Show ball speed indicator (faster = more red trail)
            if (zProgress < 0.8 && zProgress > 0.1) {
                ctx.beginPath();
                ctx.moveTo(ballCamX, finalBallY - radius);
                ctx.lineTo(ballCamX, finalBallY - radius - 20 * (1 - zProgress));
                ctx.strokeStyle = 'rgba(255, 100, 50, 0.4)';
                ctx.lineWidth = radius * 0.8;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }
    }

    /**
     * Check for hand-based hit (using 5 fingers as bat)
     */
    checkForHandHit() {
        // Check if ball is in hitting zone
        if (!this.physics.isInHittingZone()) return;

        // Check if hand is swinging
        if (!this.batting.isSwinging) return;

        // Check if hand is in hit position
        if (!this.batting.isInHitPosition()) return;

        // HIT DETECTED!
        this.hasHitThisDelivery = true;
        console.log('🏏 HAND HIT DETECTED!');

        // Calculate shot based on hand movement
        const ballPos = this.physics.getBallPosition();
        const shot = this.batting.calculateShot(ballPos);
        const direction = this.batting.getHitDirection();

        // Apply hit to physics with extra power for hand swings
        const power = Math.max(shot.power, 0.7);
        this.physics.hit(direction, power);

        // Show shot name
        this.ui.showShotResult(shot.name);

        // Show impact effect at hand position
        const camPanel = document.getElementById('camera-panel');
        const bounds = this.batting.handBounds;
        if (bounds) {
            this.ui.showImpactEffect(
                bounds.centerX * camPanel.clientWidth,
                bounds.centerY * camPanel.clientHeight
            );
        }
        console.log('HAND HIT!', shot.name, 'Direction:', direction, 'Power:', power.toFixed(2));
    }

    /**
     * Check for bat-ball collision
     * Following Bat Fixation Guide - Step 5: Apply hit with swing direction
     */
    checkForBatHit() {
        if (!this.bat || !this.physics) return;

        // Get ball position as THREE.Vector3
        const ballPos = this.physics.getBallPosition();
        if (!ballPos) return;

        const ballVector = new THREE.Vector3(ballPos.x, ballPos.y, ballPos.z);

        // Check collision with bat (distance-based)
        // INCREASED radius from 0.3 to 0.6 for easier hits
        const collision = this.bat.checkCollision(ballVector, 0.6);

        if (collision && collision.hit) {
            this.hasHitThisDelivery = true;

            // === STEP 5: Apply Hit with Swing Direction ===

            // Get zone power from collision result (already resolved)
            const zonePower = collision.effect?.power ?? collision.zoneMultiplier ?? 1.0;

            // Check for handle hit (no power)
            if (zonePower < 0.15) {
                this.ui.showShotResult('Handle! No shot');
                console.log('🏏 Hit on HANDLE - no power');
                return;
            }

            // Calculate swing speed
            const swingSpeed = Math.sqrt(
                collision.swingVelocity.x ** 2 +
                collision.swingVelocity.y ** 2
            );

            // Hit direction from swing velocity
            // NOTE: physics.hit() negates Z internally, so positive Z here = forward
            const hitDirection = {
                x: -collision.swingVelocity.x * 2.0, // Invert for mirror, amplify
                y: Math.max(0.2, 0.5 - collision.swingVelocity.y * 0.3), // Height
                z: 2.0 // POSITIVE - physics will negate, making ball go forward
            };

            // Normalize direction vector
            const mag = Math.sqrt(
                hitDirection.x ** 2 +
                hitDirection.y ** 2 +
                hitDirection.z ** 2
            );
            hitDirection.x /= mag;
            hitDirection.y /= mag;
            hitDirection.z /= mag;

            // === NEW EXIT VELOCITY PHYSICS ===
            const batSpeed = collision.batSpeed || 5;
            const zoneMultiplier = collision.zoneMultiplier || 1.0;
            const deflection = collision.deflection || 0;
            const timingMultiplier = collision.timingMultiplier || 1.0;
            const timingQuality = collision.timingQuality || 'Good';

            // Get current bowl speed for momentum calculation
            const bowlSpeed = this.currentBowlSpeed || 30;

            // Get launch angle from shot type
            const shot = this.batting.calculateShot(this.physics.getBallPosition());
            const launchAngle = shot.launchAngle || 22;

            // Apply hit using CORRECTED exit velocity physics
            // Parameters: direction, batSpeed, zoneMultiplier, deflection, bowlSpeed, launchAngle, timingMultiplier
            this.physics.hit(hitDirection, batSpeed, zoneMultiplier, deflection, bowlSpeed, launchAngle, timingMultiplier);

            // Show hit message with timing quality
            const zoneDisplay = `${collision.zone.toUpperCase()}! ${timingQuality} timing - ${batSpeed.toFixed(1)}m/s`;
            this.ui.showShotResult(zoneDisplay);

            // Update persistent speed display
            this.ui.updateSwingSpeed(batSpeed);

            // Ensure delivery is NOT complete yet - wait for ball to land
            this.deliveryComplete = false;

            // Show impact effect
            const camPanel = document.getElementById('camera-panel');
            this.ui.showImpactEffect(camPanel.clientWidth / 2, camPanel.clientHeight / 2);

            console.log(`🏏 BAT HIT! Zone: ${collision.zone}, Speed: ${batSpeed.toFixed(1)}m/s, Timing: ${timingQuality} (${timingMultiplier}x)`);

            // === Zoom out camera to track ball in direction of shot ===
            if (this.renderer.controls) {
                this.renderer.controls.zoomOutForBallTracking(hitDirection);
            }
        }
    }

    /**
     * Start a bowl with current settings
     */
    bowl() {
        if (this.state !== 'idle') return;

        // Get bowling options from UI
        const options = this.ui.getBowlingOptions();
        this.bowling.setSpeed(options.speed);
        this.bowling.setLine(options.line);
        this.bowling.setLength(options.length);

        // Start bowling
        this.startDelivery();
    }

    /**
     * Random bowl
     */
    randomBowl() {
        if (this.state !== 'idle') return;

        const delivery = this.bowling.randomDelivery();

        // Update UI to show random selection
        this.ui.setBowlingControls({
            speed: this.bowling.speed,
            line: this.bowling.line,
            length: this.bowling.length
        });

        this.startDelivery();
    }

    /**
     * Start a delivery
     */
    startDelivery() {
        this.state = 'bowling';
        this.hasHitThisDelivery = false;
        this.ui.setBowlEnabled(false);

        // Reset ball and clear trail
        this.renderer.clearTrail();
        this.batting.reset();

        // Get bowling parameters
        const params = this.bowling.getDeliveryParams();

        // Store bowl speed for hit calculation (momentum transfer)
        this.currentBowlSpeed = params.speed;

        // Set up callback for scoring after 2nd bounce
        this.physics.onSecondBounce = (distance) => {
            if (this.state !== 'delivery_complete') {
                this.completeDelivery(distance);
            }
        };

        // Bowl the ball
        this.physics.bowl(params);

        // Transition to batting state after ball is released
        setTimeout(() => {
            this.state = 'batting';
        }, 100);

        this.totalBalls++;
        this.ui.updateScore(this.totalRuns, this.totalBalls);
    }

    /**
     * Check if player hit the ball
     */
    checkForHit() {
        if (!this.physics.isInHittingZone()) return;
        if (this.hasHitThisDelivery) return; // Prevent multiple hits

        const palmPosition = this.batting.handPosition;
        if (!palmPosition) return;

        // Check if swinging
        if (!this.batting.isSwinging) return;

        // Check if hand is in hit position
        if (!this.batting.isInHitPosition()) return;

        // Hit detected!
        this.hasHitThisDelivery = true;

        // Calculate shot
        const ballPos = this.physics.getBallPosition();
        const shot = this.batting.calculateShot(ballPos);
        const direction = this.batting.getHitDirection();

        // Apply hit to physics
        this.physics.hit(direction, shot.power);

        // Show impact effect
        const camWidth = document.getElementById('camera-panel').clientWidth;
        const camHeight = document.getElementById('camera-panel').clientHeight;
        this.ui.showImpactEffect(
            palmPosition.x * camWidth,
            palmPosition.y * camHeight
        );

        console.log('HIT!', shot.name, 'Power:', shot.power.toFixed(2));
    }

    /**
     * Main game loop
     */
    gameLoop(currentTime) {
        if (!this.isRunning) return;

        // Calculate delta time
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // Update FPS counter
        this.frameCount++;
        if (currentTime - this.lastFpsUpdate > 1000) {
            this.fps = this.frameCount;
            this.frameCount = 0;
            this.lastFpsUpdate = currentTime;
        }

        // Update physics
        if (this.state === 'bowling' || this.state === 'batting') {
            this.physics.update(deltaTime);
            this.updateBallVisuals();
        }

        // Check for delivery completion
        if (this.state === 'batting') {
            this.checkDeliveryComplete();
        }

        // Update camera animations (smooth transitions)
        if (this.renderer.controls) {
            this.renderer.controls.update();
        }

        // Render 3D scene
        this.renderer.render();

        // Request next frame
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    /**
     * Update ball visuals in both views
     */
    updateBallVisuals() {
        const ballPos = this.physics.getBallPosition();

        // Update 3D renderer
        this.renderer.updateBallPosition(ballPos.x, ballPos.y, ballPos.z);

        // Update camera overlay
        const camPanel = document.getElementById('camera-panel');
        this.ui.updateBallOverlay(ballPos, camPanel.clientWidth, camPanel.clientHeight);

        // Add trail point occasionally
        if (this.frameCount % 3 === 0) {
            this.renderer.addTrailPoint(ballPos.x, ballPos.y, ballPos.z);
        }

        // Camera follows ball if hit
        if (this.hasHitThisDelivery) {
            this.renderer.followBall(ballPos);

            // === Distance Tracking & Scoring ===
            if (!this.deliveryComplete) {
                const distance = this.physics.getDistanceFromStumps();

                // Update UI with current distance
                this.ui.updateDistance(distance);

                // Check if ball crossed boundary or stopped
                const crossedBoundary = this.physics.checkBoundary(distance);
                const isStopped = this.physics.isBallStopped();

                if (crossedBoundary || isStopped) {
                    this.completeDelivery(distance);
                }
            }
        }
    }

    /**
     * Complete delivery and calculate score
     */
    completeDelivery(distance) {
        if (this.state === 'delivery_complete') return; // Prevent double scoring

        this.state = 'delivery_complete';
        this.deliveryComplete = true;

        // Calculate runs based on distance and bounce
        const hasBounced = this.physics.hasBounced;
        const runs = this.batting.calculateRuns('Hit', distance, hasBounced);

        // Update score
        this.score += runs;
        this.ballsFaced++;
        this.ui.updateScore(this.score, this.ballsFaced);

        // Show result
        let resultText = `${distance.toFixed(1)}m`;
        if (runs === 4) resultText = `FOUR! ${resultText}`;
        else if (runs === 6) resultText = `SIX! ${resultText}`;
        else if (runs === 0) resultText = `Dot Ball (${resultText})`;
        else resultText = `${runs} Runs (${resultText})`;

        this.ui.showShotResult(resultText);
        this.ui.showLastShot('Hit', runs);

        // Reset for next ball after delay
        setTimeout(() => {
            this.resetForNextDelivery();
        }, 3000);
    }

    /**
     * Check if delivery is complete
     */
    checkDeliveryComplete() {
        const ballPos = this.physics.getBallPosition();

        // Check for Bowled (hitting stumps)
        // Stumps are at Z=10, X=0 (approx width 0.23m)
        if (Math.abs(ballPos.z - 10) < 0.5 && Math.abs(ballPos.x) < 0.15 && ballPos.y < 0.8) {
            this.endDelivery('bowled');
            return;
        }

        // Ball passed batsman without hit
        if (!this.hasHitThisDelivery && this.physics.hasBallPassedBatsman()) {
            this.endDelivery('miss');
            return;
        }

        // Ball stopped after hit
        if (this.hasHitThisDelivery && this.physics.isBallStopped()) {
            this.endDelivery('hit');
            return;
        }

        // Ball went out of bounds
        if (Math.abs(ballPos.x) > 100 || Math.abs(ballPos.z) > 100) {
            this.endDelivery('boundary');
            return;
        }
    }

    /**
     * End delivery and calculate result
     */
    endDelivery(outcome) {
        this.state = 'result';

        let runs = 0;
        let shotName = 'Miss!';

        if (outcome === 'hit' || outcome === 'boundary') {
            const prediction = this.physics.predictLandingZone();
            const shot = this.batting.calculateShot(this.physics.getBallPosition());
            shotName = shot.name;
            // Use hasBounced from physics, or estimate based on distance for prediction
            const hasBounced = this.physics.hasBounced || (prediction.distance > 60 && prediction.distance < 70); // Simple fallback
            runs = this.batting.calculateRuns(shotName, prediction.distance, this.physics.hasBounced);
        }

        // Update score
        this.totalRuns += runs;
        this.ui.updateScore(this.totalRuns, this.totalBalls);
        this.ui.showLastShot(shotName, runs);

        // Show result
        let resultText = shotName;
        if (outcome === 'bowled') resultText = '🔥 BOWLED! 🔥';
        else if (runs === 6) resultText = '🎉 SIX! 🎉';
        else if (runs === 4) resultText = '🏏 FOUR! 🏏';
        else if (runs > 0) resultText = `${runs} Run${runs > 1 ? 's' : ''}`;

        this.ui.showShotResult(resultText);

        // Reset for next delivery
        setTimeout(() => {
            this.resetForNextDelivery();
        }, 3000);
    }

    /**
     * Reset game state for next delivery
     */
    resetForNextDelivery() {
        this.state = 'idle';
        this.hasHitThisDelivery = false;

        this.physics.resetBall();
        this.renderer.hideBall();
        this.renderer.clearTrail();
        this.renderer.resetCamera();
        this.ui.hideBallOverlay();
        this.ui.setBowlEnabled(true);
        this.batting.reset();

        // Reset realistic batting systems
        this.shotStateMachine.reset();
        this.timingSystem.reset();
        this.bat.resetShotState();

        // === NEW: Zoom in camera for next delivery ===
        if (this.renderer.controls) {
            this.renderer.controls.zoomInForBatting();
        }

        // Auto-bowl if enabled
        if (this.ui.isAutoBowlEnabled()) {
            setTimeout(() => {
                if (this.state === 'idle') {
                    this.bowl();
                }
            }, 2000); // 2 second delay between deliveries
        }
    }

    /**
     * Start game loop
     */
    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.gameLoop(t));
    }

    /**
     * Stop game
     */
    stop() {
        this.isRunning = false;
        this.camera.stop();
        this.handTracking.stop();
        this.renderer.stop();
    }
}

// Initialize game when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    const game = new CricketARGame();
    game.init();

    // Expose for debugging
    window.cricketGame = game;
});
