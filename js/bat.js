/**
 * Cricket Bat Module - 3D bat with zone-based hit detection
 * 
 * Bat Zones:
 * - Handle (15%): For holding, no hit
 * - Shoulder (15%): Straight up shots, 0-1 runs
 * - Middle (35%): Sweet spot, power shots, 4-6 runs
 * - Toe (15%): Low shots, 1-2 runs
 * - Edges (20%): Behind wicket deflections, 0-4 runs
 */

import * as THREE from 'three';

export class Bat {
    constructor() {
        // Bat dimensions (in game units)
        this.dimensions = {
            totalLength: 4.0,      // Total bat length
            bladeWidth: 0.8,       // Width of blade
            bladeDepth: 0.15,      // Thickness of blade
            handleLength: 1.2,     // Handle length
            handleRadius: 0.08     // Handle radius
        };

        // Zone percentages (from top to bottom)
        this.zones = {
            handle: { start: 0, end: 0.15, name: 'Handle' },
            shoulder: { start: 0.15, end: 0.30, name: 'Shoulder' },
            middle: { start: 0.30, end: 0.65, name: 'Middle' },  // Sweet spot!
            toe: { start: 0.65, end: 0.80, name: 'Toe' },
            // Edges are detected by x-position, not y
        };

        // Zone hit effects
        this.zoneEffects = {
            handle: { power: 0, height: 0, description: 'No shot - handle!' },
            shoulder: { power: 0.3, height: 0.8, description: 'Lofted to inner circle' },
            middle: { power: 1.0, height: 0.5, description: 'Sweet spot - POWER!' },
            toe: { power: 0.4, height: 0.2, description: 'Low shot along ground' },
            edge: { power: 0.6, height: 0.4, description: 'Edge - behind wicket!' }
        };

        // 3D Objects
        this.batGroup = null;
        this.bladeMesh = null;
        this.handleMesh = null;

        // Position and rotation
        this.position = { x: 0, y: 0, z: 10 }; // Near batting end
        this.rotation = { x: 0, y: 0, z: 0 };

        // For collision detection
        this.boundingBox = null;
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

        // Position bat at batting crease
        this.batGroup.position.set(0, 2, 10);
        this.batGroup.rotation.x = Math.PI / 6; // Slight angle

        scene.add(this.batGroup);

        // Create bounding box for collision
        this.updateBoundingBox();

        console.log('🏏 Cricket bat created with zones');
        return this.batGroup;
    }

    /**
     * Update bat position and ROTATION based on hand landmarks
     * 
     * CRICKET BATTING MOTION:
     * - Fingers DOWN (pointing down) = Bat HORIZONTAL (ready to hit)
     * - Fingers UP (pointing up) = Bat VERTICAL (lifted/backswing)
     * 
     * Key landmarks:
     * - 0: Wrist
     * - 12: Middle finger tip
     */
    updateFromLandmarks(landmarks, handVelocity) {
        if (!this.batGroup || !landmarks || landmarks.length < 21) return;

        // Get key landmarks
        const wrist = landmarks[0];        // Base of hand
        const indexBase = landmarks[5];    // Index finger base
        const middleBase = landmarks[9];   // Middle finger base
        const pinkyBase = landmarks[17];   // Pinky base
        const middleTip = landmarks[12];   // Middle finger tip

        // Calculate hand center (palm position)
        const palmCenter = {
            x: (wrist.x + middleBase.x) / 2,
            y: (wrist.y + middleBase.y) / 2
        };

        // Map palm position to 3D world
        const batX = (0.5 - palmCenter.x) * 6; // Inverted for mirror
        const batY = (1 - palmCenter.y) * 3.5 + 0.5;

        // Smooth position movement
        this.batGroup.position.x += (batX - this.batGroup.position.x) * 0.3;
        this.batGroup.position.y += (batY - this.batGroup.position.y) * 0.3;

        // === CALCULATE HAND ROTATION FOR CRICKET MOTION ===

        // Vector from wrist to middle finger tip
        const dx = middleTip.x - wrist.x;
        const dy = middleTip.y - wrist.y;

        // Calculate hand angle
        // atan2(dx, dy) where positive dy = fingers pointing DOWN
        // When fingers point DOWN (dy > 0): angle ≈ 0 → bat should be HORIZONTAL
        // When fingers point UP (dy < 0): angle ≈ PI → bat should be VERTICAL
        const handAngle = Math.atan2(dx, dy);

        // CRICKET MAPPING:
        // handAngle ≈ 0 (fingers down) → bat rotation = PI/2 (horizontal, ready to hit)
        // handAngle ≈ PI (fingers up) → bat rotation = 0 (vertical, lifted)
        // We add PI/2 offset so fingers-down = horizontal bat
        const targetRotZ = handAngle + Math.PI / 2;

        // Side tilt for off-side/leg-side angles
        const sideDx = pinkyBase.x - indexBase.x;
        const sideDy = pinkyBase.y - indexBase.y;
        const sideAngle = Math.atan2(sideDy, sideDx);

        // X rotation = forward tilt (hitting angle)
        const targetRotX = sideAngle * 0.4;

        // Smooth rotation
        this.batGroup.rotation.z += (targetRotZ - this.batGroup.rotation.z) * 0.3;
        this.batGroup.rotation.x += (targetRotX - this.batGroup.rotation.x) * 0.25;

        // Store current hand angle for swing detection
        this.currentHandAngle = handAngle;

        // Detect swing motion (rapid change from fingers-up to fingers-down)
        this.isSwinging = handVelocity && Math.abs(handVelocity.y) > 1.5;

        this.updateBoundingBox();
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
     * Check if ball collides with bat and determine hit zone
     * @param {THREE.Vector3} ballPosition - Ball position
     * @param {number} ballRadius - Ball radius
     * @returns {Object|null} - Hit info with zone, or null if no hit
     */
    checkCollision(ballPosition, ballRadius = 0.3) {
        if (!this.boundingBox || !this.batGroup) return null;

        // Create ball bounding sphere
        const ballSphere = new THREE.Sphere(ballPosition, ballRadius);

        // Check if ball intersects bat bounding box
        if (!this.boundingBox.intersectsSphere(ballSphere)) {
            return null;
        }

        // Determine which zone was hit
        const zone = this.determineHitZone(ballPosition);

        return {
            hit: true,
            zone: zone,
            effect: this.zoneEffects[zone],
            batPosition: this.batGroup.position.clone(),
            batRotation: this.batGroup.rotation.clone()
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
     * Reset bat position
     */
    reset() {
        if (this.batGroup) {
            this.batGroup.position.set(0, 2, 10);
            this.batGroup.rotation.set(Math.PI / 6, 0, 0);
        }
    }
}
