/**
 * Cricket Bat Module - 3D bat with zone-based hit detection
 * 
 * Uses GAME_CONFIG for zone multipliers and collision settings.
 * 
 * Bat Zones:
 * - Handle (15%): For holding, no hit
 * - Shoulder (15%): Straight up shots, 0-1 runs
 * - Middle (35%): Sweet spot, power shots, 4-6 runs
 * - Toe (15%): Low shots, 1-2 runs
 * - Edges (20%): Behind wicket deflections, 0-4 runs
 */

import * as THREE from 'three';
import { GAME_CONFIG, getTimingQuality, getSpeedFactor } from './config.js';

export class Bat {
    constructor() {
        // Store config reference
        this.config = GAME_CONFIG;

        // Bat dimensions (in game units)
        this.dimensions = {
            totalLength: 4.0,      // Total bat length
            bladeWidth: 0.8,       // Width of blade
            bladeDepth: 0.15,      // Thickness of blade
            handleLength: 1.2,     // Handle length
            handleRadius: 0.08     // Handle radius
        };

        // Get zone config
        const { batZones } = this.config;

        // Zone percentages (from top to bottom) - from config
        this.zones = {
            handle: { start: batZones.handle.start, end: batZones.handle.end, name: 'Handle' },
            shoulder: { start: batZones.shoulder.start, end: batZones.shoulder.end, name: 'Shoulder' },
            middle: { start: batZones.middle.start, end: batZones.middle.end, name: 'Middle' },
            lower: { start: batZones.lower.start, end: batZones.lower.end, name: 'Lower' },
            toe: { start: batZones.toe.start, end: batZones.toe.end, name: 'Toe' }
        };

        // Zone hit effects - use config multipliers
        this.zoneEffects = {
            handle: { power: batZones.handle.multiplier, height: 0, description: 'No shot - handle!' },
            shoulder: { power: batZones.shoulder.multiplier, height: 0.8, description: 'Lofted to inner circle' },
            middle: { power: batZones.middle.multiplier, height: 0.5, description: 'Sweet spot - POWER!' },
            lower: { power: batZones.lower.multiplier, height: 0.35, description: 'Lower blade contact' },
            toe: { power: batZones.toe.multiplier, height: 0.2, description: 'Low shot along ground' },
            edge: { power: batZones.edgeMultiplier, height: 0.4, description: 'Edge - behind wicket!' }
        };

        // 3D Objects
        this.batGroup = null;
        this.bladeMesh = null;
        this.handleMesh = null;

        // Position and rotation
        this.position = { x: 0, y: 0, z: 8 }; // In front of wickets (Z=10)
        this.rotation = { x: 0, y: 0, z: 0 };

        // For collision detection
        this.boundingBox = null;

        // Swing detection (Step 4)
        this.previousHandPosition = null;
        this.previousTime = Date.now();
        this.swingVelocity = { x: 0, y: 0, z: 0 };
        this.isSwinging = false;
        this.swingThreshold = 0.5; // Lower threshold (was 2.0) for easier detection
        this.currentHandAngle = 0;

        // Visual guides (Phase 2)
        this.shadow = null;              // Ground shadow
        this.collisionZone = null;       // Collision zone sphere
        this.gripIndicator = null;       // Grip point indicator
        this.trailPositions = [];        // Swing trail positions
        this.trailMeshes = [];           // Swing trail meshes
        this.maxTrailLength = 10;
        this.scene = null;               // Store scene reference

        // Visual guide toggles
        this.showShadow = true;
        this.showCollisionZone = true;
        this.showGripIndicator = true;
        this.showTrail = true;

        // === NEW: Realistic batting mechanics ===

        // Bat angle tracking (for shot phases)
        this.batAngle = 0;               // Current bat angle (0° = vertical)
        this.previousAngle = 0;
        this.angleVelocity = 0;          // Rate of angle change

        // Shot phase detection
        this.shotPhase = 'stance';       // stance, backlift, downswing, follow_through
        this.backliftStartTime = null;
        this.downswingStartTime = null;

        // Dynamic height range (for different ball lengths)
        this.minBatHeight = 0.35;        // Yorker height
        this.maxBatHeight = 5.0;         // INCREASED: Short ball/bouncer height
        this.heightMultiplier = 4.0;     // INCREASED: Controls sensitivity

        // Dynamic depth (front/back foot)
        this.baseZ = 8;                  // At crease
        this.minZ = 6.5;                 // Maximum front foot (1.5m forward)
        this.maxZ = 9.5;                 // Maximum back foot (1.5m back)
        this.currentFootPosition = 'neutral'; // front, neutral, back

        // Shot direction tracking
        this.shotDirection = 'straight'; // offside, straight, onside

        // Hand data for state machine
        this.handData = {
            angle: 0,
            velocity: { x: 0, y: 0, z: 0, magnitude: 0 },
            position: { x: 0, y: 0, z: 0 },
            isTracking: false
        };
    }

    /**
     * Create 3D bat geometry
     */
    create(scene) {
        this.batGroup = new THREE.Group();
        this.batGroup.name = 'cricketBat';

        // Materials
        const bladeMaterial = new THREE.MeshLambertMaterial({
            color: 0xf5e6d3 // Light wood color
        });
        const handleMaterial = new THREE.MeshLambertMaterial({
            color: 0x2c5aa0 // Blue grip
        });
        const edgeMaterial = new THREE.MeshLambertMaterial({
            color: 0xe8d4b8 // Slightly different wood tone for edges
        });

        // Handle (cylinder at top)
        const handleGeometry = new THREE.CylinderGeometry(
            this.dimensions.handleRadius,
            this.dimensions.handleRadius * 1.2,
            this.dimensions.handleLength,
            12
        );
        this.handleMesh = new THREE.Mesh(handleGeometry, handleMaterial);
        this.handleMesh.position.y = this.dimensions.totalLength / 2 - this.dimensions.handleLength / 2;
        this.handleMesh.name = 'handle';
        this.batGroup.add(this.handleMesh);

        // Blade (main hitting surface) - box geometry
        const bladeLength = this.dimensions.totalLength - this.dimensions.handleLength;
        const bladeGeometry = new THREE.BoxGeometry(
            this.dimensions.bladeWidth,
            bladeLength,
            this.dimensions.bladeDepth
        );
        this.bladeMesh = new THREE.Mesh(bladeGeometry, bladeMaterial);
        this.bladeMesh.position.y = -this.dimensions.handleLength / 2;
        this.bladeMesh.name = 'blade';
        this.batGroup.add(this.bladeMesh);

        // Edge highlights (thin boxes on sides)
        const edgeWidth = 0.05;
        const leftEdgeGeometry = new THREE.BoxGeometry(edgeWidth, bladeLength, this.dimensions.bladeDepth + 0.02);
        const leftEdge = new THREE.Mesh(leftEdgeGeometry, edgeMaterial);
        leftEdge.position.set(-this.dimensions.bladeWidth / 2, -this.dimensions.handleLength / 2, 0);
        leftEdge.name = 'leftEdge';
        this.batGroup.add(leftEdge);

        const rightEdge = new THREE.Mesh(leftEdgeGeometry, edgeMaterial);
        rightEdge.position.set(this.dimensions.bladeWidth / 2, -this.dimensions.handleLength / 2, 0);
        rightEdge.name = 'rightEdge';
        this.batGroup.add(rightEdge);

        // Position bat at batting crease - NATURAL BATTING STANCE
        // Height: 1.0 (waist level, ready to hit)
        // Angle: Horizontal (ready position)
        // Z-position: 12 (in front of wickets, not inside them!)
        this.batGroup.position.set(0, 1.0, 12);
        this.batGroup.rotation.x = 0; // No forward tilt initially
        this.batGroup.rotation.y = 0; // Facing straight
        this.batGroup.rotation.z = Math.PI / 2; // Horizontal (ready to hit)

        scene.add(this.batGroup);

        // Store scene reference for trail
        this.scene = scene;

        // === PHASE 2: Visual Guides ===

        // 1. Ground Shadow
        const shadowGeometry = new THREE.CircleGeometry(0.5, 32);
        const shadowMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide
        });
        this.shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
        this.shadow.rotation.x = -Math.PI / 2; // Horizontal
        this.shadow.position.set(0, 0.01, 12); // Just above ground
        this.shadow.visible = this.showShadow;
        scene.add(this.shadow);

        // 2. Collision Zone (sphere around bat)
        const zoneGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const zoneMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.2,
            wireframe: true
        });
        this.collisionZone = new THREE.Mesh(zoneGeometry, zoneMaterial);
        this.collisionZone.visible = this.showCollisionZone;
        this.batGroup.add(this.collisionZone);

        // 3. Grip Indicator (small sphere at grip point)
        const gripGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const gripMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.6
        });
        this.gripIndicator = new THREE.Mesh(gripGeometry, gripMaterial);
        this.gripIndicator.position.y = this.dimensions.totalLength / 2 - this.dimensions.handleLength / 2;
        this.gripIndicator.visible = this.showGripIndicator;
        this.batGroup.add(this.gripIndicator);

        // Create bounding box for collision
        this.updateBoundingBox();

        console.log('🏏 Cricket bat created with zones');
        return this.batGroup;
    }

    /**
     * Update bat position based on hand landmarks
     * Following Bat Fixation Guide - Steps 2 & 4
     * 
     * Step 2: Direct position control (no smoothing)
     * Step 4: Swing detection (velocity tracking)
     */
    updateFromLandmarks(landmarks, handVelocity) {
        if (!this.batGroup || !landmarks || landmarks.length < 21) return;

        // Get key landmarks
        const wrist = landmarks[0];
        const indexBase = landmarks[5];
        const middleBase = landmarks[9];
        const pinkyBase = landmarks[17];
        const middleTip = landmarks[12];

        // === STEP 2: Direct Position Control ===

        // Calculate palm center (grip point)
        const palmCenter = {
            x: (wrist.x + middleBase.x) / 2,
            y: (wrist.y + middleBase.y) / 2
        };

        // === NEW: Dynamic positioning for all ball lengths ===

        // X-axis: Horizontal position (inverted for mirror)
        const batX = (0.5 - palmCenter.x) * 6;

        // Y-axis: DYNAMIC HEIGHT - allows hitting yorkers to bouncers
        // Hand position directly controls bat height
        const batY = this.calculateDynamicHeight(palmCenter.y);

        // Z-axis: DYNAMIC DEPTH - front/back foot based on hand size
        const batZ = this.calculateDynamicDepth(landmarks);

        // Detect shot direction from hand X position
        this.detectShotDirection(palmCenter.x);

        // DIRECT position update (no smoothing for responsiveness)
        this.batGroup.position.x = batX;
        this.batGroup.position.y = batY;
        this.batGroup.position.z = batZ;

        // Calculate hand orientation
        const handForward = {
            x: middleTip.x - wrist.x,
            y: middleTip.y - wrist.y
        };

        const handRight = {
            x: pinkyBase.x - indexBase.x,
            y: pinkyBase.y - indexBase.y
        };

        // Hand angle for bat rotation
        const handAngle = Math.atan2(handForward.x, handForward.y);
        const sideTilt = Math.atan2(handRight.y, handRight.x);

        // Apply rotation constraints inline
        const rotZ = this.clamp(handAngle + Math.PI / 2, -0.79, 2.36); // -45° to +135°
        const rotX = this.clamp(sideTilt * 0.4, -2.09, 0.52); // -120° to +30°

        // DIRECT rotation update (no smoothing)
        this.batGroup.rotation.z = rotZ;
        this.batGroup.rotation.x = rotX;
        this.batGroup.rotation.y = 0;

        // === NEW: Shot Phase Detection ===
        // Detect if player is in stance, backlift, downswing, or follow-through
        this.detectShotPhase(landmarks);

        // === STEP 4: Swing Detection ===

        const currentTime = Date.now();
        const deltaTime = (currentTime - this.previousTime) / 1000;

        if (this.previousHandPosition && deltaTime > 0) {
            // Calculate hand velocity
            const velocityX = (palmCenter.x - this.previousHandPosition.x) / deltaTime;
            const velocityY = (palmCenter.y - this.previousHandPosition.y) / deltaTime;

            const speed = Math.sqrt(velocityX * velocityX + velocityY * velocityY);

            // Detect swing (speed > threshold)
            if (speed > this.swingThreshold) {
                this.isSwinging = true;
                this.swingVelocity = {
                    x: velocityX,
                    y: velocityY,
                    z: 0
                };
            } else {
                this.isSwinging = false;
            }
        }

        // Store for next frame
        this.previousHandPosition = { x: palmCenter.x, y: palmCenter.y };
        this.previousTime = currentTime;
        this.currentHandAngle = handAngle;

        // === Update Visual Guides ===

        // Update ground shadow
        if (this.shadow) {
            this.shadow.position.x = this.batGroup.position.x;
            this.shadow.position.z = this.batGroup.position.z;
            // Fade shadow based on height
            const height = this.batGroup.position.y;
            this.shadow.material.opacity = Math.max(0, 0.5 - height * 0.1);
        }

        // Update collision zone color (green when swinging)
        if (this.collisionZone) {
            if (this.isSwinging) {
                this.collisionZone.material.color.setHex(0x00ff00); // Green
                this.collisionZone.material.opacity = 0.4;
            } else {
                this.collisionZone.material.color.setHex(0x00ffff); // Cyan
                this.collisionZone.material.opacity = 0.2;
            }
        }

        // Update swing trail
        if (this.showTrail && this.isSwinging) {
            this.updateTrail();
        } else {
            this.clearTrail();
        }

        this.updateBoundingBox();
    }

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    /**
     * Simplified ground collision - no wicket avoidance needed
     * Bat is at fixed Z=12, wickets at Z=10, so no collision possible
     */
    enforceGroundCollision() {
        // Not needed - ground check is done inline in updateFromLandmarks
    }

    /**
     * Legacy method for backwards compatibility
     */
    updateFromHand(handPosition, handVelocity) {
        // If only position is provided (no landmarks), use simple positioning
        if (!this.batGroup || !handPosition) return;

        const batX = (0.5 - handPosition.x) * 6;
        const batY = (1 - handPosition.y) * 3.5 + 0.5;

        this.batGroup.position.x += (batX - this.batGroup.position.x) * 0.3;
        this.batGroup.position.y += (batY - this.batGroup.position.y) * 0.3;

        if (handVelocity) {
            const targetRotZ = -handVelocity.x * 0.5;
            const targetRotX = Math.PI / 6 + handVelocity.y * 0.3;
            this.batGroup.rotation.z += (targetRotZ - this.batGroup.rotation.z) * 0.2;
            this.batGroup.rotation.x += (targetRotX - this.batGroup.rotation.x) * 0.2;
        }

        this.updateBoundingBox();
    }

    /**
     * Update bounding box for collision detection
     */
    updateBoundingBox() {
        if (!this.batGroup) return;

        this.boundingBox = new THREE.Box3().setFromObject(this.batGroup);
    }

    /**
     * Check if ball collides with bat using distance-based detection
     * Uses GAME_CONFIG for collision thresholds and timing quality.
     * 
     * @param {THREE.Vector3} ballPosition - Ball position
     * @param {number} ballRadius - Ball radius
     * @returns {Object|null} - Hit info with zone, or null if no hit
     */
    checkCollision(ballPosition, ballRadius = 0.3) {
        if (!this.batGroup) return null;

        const { collision } = this.config;

        // Calculate per-axis distances
        const dx = ballPosition.x - this.batGroup.position.x;
        const dy = ballPosition.y - this.batGroup.position.y;
        const dz = ballPosition.z - this.batGroup.position.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        // Use config collision threshold (more skill-based)
        const collisionDistance = collision.hitThreshold + ballRadius;

        // Log when ball is near bat Z (for debugging)
        if (Math.abs(dz) < 1.5) {
            console.log(`🎯 Ball: dist=${distance.toFixed(2)}m, threshold=${collisionDistance.toFixed(2)}m`);
        }

        // Check collision
        if (distance < collisionDistance) {
            // === TIMING QUALITY from config ===
            const absDz = Math.abs(dz);
            const timing = getTimingQuality(absDz);
            const timingQuality = timing.quality;
            const timingMultiplier = timing.multiplier;

            // Calculate bat speed in m/s
            // swingVelocity is per-frame, multiply by ~40 (was 25) for more responsiveness
            const rawSpeed = this.swingVelocity ? Math.sqrt(
                this.swingVelocity.x ** 2 +
                this.swingVelocity.y ** 2 +
                this.swingVelocity.z ** 2
            ) * 40 : 0;

            // Cap at realistic human maximum (20 m/s = 72 km/h)
            const batSpeed = Math.min(rawSpeed, 20);

            // Speed factor based on bat speed
            let speedFactor = 0.2; // Block
            if (batSpeed >= 15) speedFactor = 1.2;      // Maximum
            else if (batSpeed >= 10) speedFactor = 1.0; // Power
            else if (batSpeed >= 6) speedFactor = 0.8;  // Attacking
            else if (batSpeed >= 3) speedFactor = 0.5;  // Placement

            // Determine zone
            const zoneInfo = this.determineDetailedZone(ballPosition);

            console.log(`🏏 HIT! Zone=${zoneInfo.name}, Speed=${batSpeed.toFixed(1)}m/s, Timing=${timingQuality} (${timingMultiplier}x)`);

            return {
                hit: true,
                zone: zoneInfo.name,
                verticalZone: zoneInfo.vertical,
                horizontalZone: zoneInfo.horizontal,
                zoneMultiplier: zoneInfo.multiplier,
                deflection: zoneInfo.deflection,
                batSpeed: batSpeed,
                speedFactor: speedFactor,
                timingQuality: timingQuality,
                timingMultiplier: timingMultiplier,
                effect: this.zoneEffects[zoneInfo.vertical] || this.zoneEffects.middle,
                batPosition: this.batGroup.position.clone(),
                batRotation: this.batGroup.rotation.clone(),
                swingVelocity: this.swingVelocity
            };
        }

        return null;
    }

    /**
     * Determine detailed 15-zone hit matrix
     * Vertical: Handle (15%), Shoulder (15%), Middle (40%), Lower (20%), Toe (10%)
     * Horizontal: Left Edge (8%), Center (84%), Right Edge (8%)
     */
    determineDetailedZone(ballPosition) {
        const localPos = ballPosition.clone();
        localPos.sub(this.batGroup.position);

        // --- Horizontal Zones (Left Edge, Center, Right Edge) ---
        const halfWidth = this.dimensions.bladeWidth / 2;
        const edgeWidth = halfWidth * 0.16; // 8% each side
        let horizontal = 'center';
        let hMultiplier = 1.0;
        let deflection = 0;

        if (localPos.x < -halfWidth + edgeWidth) {
            horizontal = 'left-edge';
            hMultiplier = 0.4;
            deflection = -0.5; // Deflect to leg side
        } else if (localPos.x > halfWidth - edgeWidth) {
            horizontal = 'right-edge';
            hMultiplier = 0.4;
            deflection = 0.5; // Deflect to off side
        }

        // --- Vertical Zones ---
        const length = this.dimensions.totalLength;
        const batBottom = -length / 2;
        const relativeY = (localPos.y - batBottom) / length; // 0=bottom, 1=top

        let vertical = 'middle';
        let vMultiplier = 1.0;

        if (relativeY > 0.85) {
            vertical = 'handle';
            vMultiplier = 0.1; // Almost no power
        } else if (relativeY > 0.70) {
            vertical = 'shoulder';
            vMultiplier = 0.3; // Weak, pop-up
        } else if (relativeY > 0.30) {
            vertical = 'middle'; // Sweet spot!
            vMultiplier = 1.0;
        } else if (relativeY > 0.10) {
            vertical = 'lower';
            vMultiplier = 0.7;
        } else {
            vertical = 'toe';
            vMultiplier = 0.4;
        }

        return {
            name: `${vertical}-${horizontal}`,
            vertical: vertical,
            horizontal: horizontal,
            multiplier: hMultiplier * vMultiplier,
            deflection: deflection
        };
    }

    /**
     * Determine which zone of the bat the ball hit
     * @param {THREE.Vector3} ballPosition - Ball position
     * @returns {string} - Zone name
     */
    determineHitZone(ballPosition) {
        // Convert ball position to bat-local coordinates
        const localPos = ballPosition.clone();
        localPos.sub(this.batGroup.position);

        // Check for edge hit first (ball on the sides)
        const edgeThreshold = this.dimensions.bladeWidth / 2 - 0.1;
        if (Math.abs(localPos.x) > edgeThreshold) {
            return 'edge';
        }

        // Determine vertical zone based on y position
        const batTop = this.dimensions.totalLength / 2;
        const batBottom = -this.dimensions.totalLength / 2;
        const relativeY = (localPos.y - batBottom) / this.dimensions.totalLength;

        // Map to zones (inverted because bat hangs down)
        const zonePosition = 1 - relativeY;

        if (zonePosition < this.zones.handle.end) {
            return 'handle';
        } else if (zonePosition < this.zones.shoulder.end) {
            return 'shoulder';
        } else if (zonePosition < this.zones.middle.end) {
            return 'middle';
        } else {
            return 'toe';
        }
    }

    /**
     * Get hit direction and power based on zone and bat rotation
     * @param {string} zone - Hit zone name
     * @param {Object} handVelocity - Hand movement velocity
     * @returns {Object} - Direction vector and power
     */
    calculateHitResult(zone, handVelocity) {
        const effect = this.zoneEffects[zone];

        if (zone === 'handle') {
            return { direction: { x: 0, y: 0, z: 0 }, power: 0, runs: 0 };
        }

        // Base direction from bat rotation
        let direction = {
            x: -Math.sin(this.batGroup.rotation.z) * 2,
            y: effect.height,
            z: 1 + effect.power
        };

        // Modify for edges (behind wicket)
        if (zone === 'edge') {
            direction.z = -0.5; // Backward
            direction.x = this.batGroup.rotation.z > 0 ? 1.5 : -1.5; // Left or right
        }

        // Add hand velocity influence
        if (handVelocity) {
            direction.x -= handVelocity.x * 1.5;
            direction.y += (-handVelocity.y * 0.3);
        }

        // Normalize
        const mag = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
        direction = {
            x: direction.x / mag,
            y: direction.y / mag,
            z: direction.z / mag
        };

        // Calculate expected runs
        let expectedRuns = 0;
        if (zone === 'middle') expectedRuns = Math.random() > 0.4 ? 6 : 4;
        else if (zone === 'edge') expectedRuns = Math.random() > 0.5 ? 4 : 0;
        else if (zone === 'shoulder') expectedRuns = Math.random() > 0.7 ? 1 : 0;
        else if (zone === 'toe') expectedRuns = Math.random() > 0.5 ? 2 : 1;

        return {
            direction,
            power: effect.power,
            runs: expectedRuns,
            zone,
            description: effect.description
        };
    }

    /**
     * Show/hide the bat
     */
    setVisible(visible) {
        if (this.batGroup) {
            this.batGroup.visible = visible;
        }
    }

    /**
     * Reset bat position to natural batting stance
     */
    reset() {
        if (this.batGroup) {
            this.batGroup.position.set(0, 1.0, 10);
            this.batGroup.rotation.set(0, 0, Math.PI / 2);
        }
    }

    /**
     * Update swing trail visualization
     */
    updateTrail() {
        if (!this.scene) return;

        // Store current position
        this.trailPositions.push(this.batGroup.position.clone());
        if (this.trailPositions.length > this.maxTrailLength) {
            this.trailPositions.shift();
        }

        // Clear old trail meshes
        this.clearTrail();

        // Create new trail spheres with decreasing opacity
        for (let i = 0; i < this.trailPositions.length; i++) {
            const opacity = i / this.trailPositions.length;
            const geometry = new THREE.SphereGeometry(0.2, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: 0xff6600,
                transparent: true,
                opacity: opacity * 0.5
            });
            const sphere = new THREE.Mesh(geometry, material);
            sphere.position.copy(this.trailPositions[i]);
            this.scene.add(sphere);
            this.trailMeshes.push(sphere);
        }
    }

    /**
     * Clear swing trail
     */
    clearTrail() {
        if (!this.scene) return;

        // Remove all trail meshes
        for (const mesh of this.trailMeshes) {
            this.scene.remove(mesh);
            mesh.geometry.dispose();
            mesh.material.dispose();
        }
        this.trailMeshes = [];
        this.trailPositions = [];
    }

    /**
     * Toggle visual guides
     */
    setShadowVisible(visible) {
        this.showShadow = visible;
        if (this.shadow) {
            this.shadow.visible = visible;
        }
    }

    setCollisionZoneVisible(visible) {
        this.showCollisionZone = visible;
        if (this.collisionZone) {
            this.collisionZone.visible = visible;
        }
    }

    setGripIndicatorVisible(visible) {
        this.showGripIndicator = visible;
        if (this.gripIndicator) {
            this.gripIndicator.visible = visible;
        }
    }

    setTrailVisible(visible) {
        this.showTrail = visible;
        if (!visible) {
            this.clearTrail();
        }
    }

    // ========================================
    // NEW: Realistic Batting Mechanics Methods
    // ========================================

    /**
     * Calculate bat angle from hand landmarks (degrees from vertical)
     * 0° = bat vertical (stance), 47° = backlift, 30° = downswing
     */
    calculateBatAngle(landmarks) {
        if (!landmarks || landmarks.length < 21) return 0;

        const wrist = landmarks[0];
        const middleMCP = landmarks[9]; // Middle finger knuckle

        // Vector from wrist to knuckle
        const dx = middleMCP.x - wrist.x;
        const dy = middleMCP.y - wrist.y;

        // Angle from vertical (0° = hand pointing up, 90° = horizontal)
        const angleRad = Math.atan2(dx, -dy);
        const angleDeg = angleRad * (180 / Math.PI);

        // Track angle velocity
        this.previousAngle = this.batAngle;
        this.batAngle = angleDeg;
        this.angleVelocity = this.batAngle - this.previousAngle;

        return angleDeg;
    }

    /**
     * Detect shot phase based on angle and velocity
     * Returns: stance, backlift, downswing, follow_through
     */
    detectShotPhase(landmarks) {
        const angle = this.calculateBatAngle(landmarks);
        const velocity = this.swingVelocity;
        const speed = Math.sqrt(velocity.x ** 2 + velocity.y ** 2);

        const previousPhase = this.shotPhase;

        // Phase detection logic based on angle and movement
        if (angle > 35 && angle < 70 && this.angleVelocity > 0) {
            // Angle increasing towards backlift (35-70°)
            this.shotPhase = 'backlift';
            if (previousPhase !== 'backlift') {
                this.backliftStartTime = Date.now();
            }
        } else if (angle < 45 && this.angleVelocity < -2 && speed > 3) {
            // Angle decreasing rapidly with forward movement
            this.shotPhase = 'downswing';
            if (previousPhase !== 'downswing') {
                this.downswingStartTime = Date.now();
            }
        } else if (angle < 0 && speed > 1) {
            // Past vertical with continued motion
            this.shotPhase = 'follow_through';
        } else if (speed < 1) {
            // Stable, low movement
            this.shotPhase = 'stance';
        }

        // Log phase changes
        if (this.shotPhase !== previousPhase) {
            console.log(`🏏 Shot Phase: ${previousPhase} → ${this.shotPhase} (angle: ${angle.toFixed(1)}°)`);
        }

        return this.shotPhase;
    }

    /**
     * Calculate dynamic bat height based on hand position
     * IMPROVED: More responsive for reaching high balls
     */
    calculateDynamicHeight(handY) {
        // handY: 0 = top of screen, 1 = bottom
        // Map to bat height: high hand = high bat (for short balls)

        // Invert so high hand = high bat
        const normalizedHeight = 1 - handY;

        // Apply AGGRESSIVE curve - small hand movement = big height change
        // Exponent 0.5 means bat responds faster to upward hand motion
        const curved = Math.pow(normalizedHeight, 0.5);

        // Map to EXTENDED height range (0.35 to 5.0 meters)
        const height = this.minBatHeight + curved * (this.maxBatHeight - this.minBatHeight);

        return Math.max(this.minBatHeight, Math.min(this.maxBatHeight, height));
    }

    /**
     * Calculate dynamic depth (Z position) based on hand size
     * Larger hand = closer to camera = front foot
     */
    calculateDynamicDepth(landmarks) {
        if (!landmarks || landmarks.length < 21) return this.baseZ;

        // Calculate hand size from palm landmarks
        const wrist = landmarks[0];
        const middleTip = landmarks[12];
        const pinkyMCP = landmarks[17];
        const indexMCP = landmarks[5];

        // Hand span (width)
        const width = Math.abs(pinkyMCP.x - indexMCP.x);
        // Hand length
        const length = Math.sqrt(
            Math.pow(middleTip.x - wrist.x, 2) +
            Math.pow(middleTip.y - wrist.y, 2)
        );

        const handSize = (width + length) / 2;

        // Map hand size to depth
        // Large (close) = 0.15+ → front foot (Z < 8)
        // Small (far) = 0.08- → back foot (Z > 8)
        if (handSize > 0.15) {
            this.currentFootPosition = 'front';
            return this.minZ + (0.20 - handSize) / 0.05 * (this.baseZ - this.minZ);
        } else if (handSize < 0.10) {
            this.currentFootPosition = 'back';
            return this.baseZ + (0.10 - handSize) / 0.05 * (this.maxZ - this.baseZ);
        } else {
            this.currentFootPosition = 'neutral';
            return this.baseZ;
        }
    }

    /**
     * Detect shot direction based on hand X position
     */
    detectShotDirection(handX) {
        // handX: 0 = left of screen, 1 = right
        // In camera view (mirrored): left hand position = off side

        if (handX < 0.35) {
            this.shotDirection = 'offside';
        } else if (handX > 0.65) {
            this.shotDirection = 'onside';
        } else {
            this.shotDirection = 'straight';
        }

        return this.shotDirection;
    }

    /**
     * Get hand data for state machine integration
     */
    getHandData() {
        return {
            angle: this.batAngle,
            velocity: {
                x: this.swingVelocity.x,
                y: this.swingVelocity.y,
                z: this.swingVelocity.z || 0,
                magnitude: Math.sqrt(
                    this.swingVelocity.x ** 2 +
                    this.swingVelocity.y ** 2 +
                    (this.swingVelocity.z || 0) ** 2
                )
            },
            position: {
                x: this.batGroup?.position.x || 0,
                y: this.batGroup?.position.y || 0,
                z: this.batGroup?.position.z || 0
            },
            isTracking: this.batGroup !== null,
            shotPhase: this.shotPhase,
            footPosition: this.currentFootPosition,
            shotDirection: this.shotDirection,
            isSwinging: this.isSwinging,
            angleVelocity: this.angleVelocity
        };
    }

    /**
     * Get timing quality info for display
     */
    getTimingInfo() {
        return {
            phase: this.shotPhase,
            backliftDuration: this.backliftStartTime
                ? Date.now() - this.backliftStartTime
                : 0,
            downswingDuration: this.downswingStartTime
                ? Date.now() - this.downswingStartTime
                : 0,
            hadBacklift: this.backliftStartTime !== null
        };
    }

    /**
     * Reset shot state for new delivery
     */
    resetShotState() {
        this.shotPhase = 'stance';
        this.backliftStartTime = null;
        this.downswingStartTime = null;
        this.currentFootPosition = 'neutral';
        this.shotDirection = 'straight';
    }
}

