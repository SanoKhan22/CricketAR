/**
 * Physics Module - Cannon-es physics world
 * 
 * Uses centralized GAME_CONFIG for all physics constants.
 * Handles ball movement, bounce tracking, and hit calculations.
 */

import * as CANNON from 'cannon-es';
import { GAME_CONFIG, calculateRuns, getTimingQuality, getSpeedFactor, getZoneAngleModifier, checkBoundary } from './config.js';

export class Physics {
    constructor() {
        this.world = null;
        this.ballBody = null;
        this.groundBody = null;

        // Get physics settings from config
        const { physics } = GAME_CONFIG;
        this.gravity = physics.gravity;
        this.restitution = physics.restitution.pitch;
        this.friction = physics.friction.pitch;

        // Store config reference for easy access
        this.config = GAME_CONFIG;

        // === SWING PHYSICS ===
        this.currentSwingType = 'none';  // 'inswing', 'outswing', 'none'
        this.swingEnabled = true;
        this.ballAge = 0;  // 0 = new, 1 = old
        this.bowlStartTime = 0;  // For flight progress tracking

        // === WICKET PHYSICS ===
        this.stumpBodies = [];  // 3 stumps (physics bodies)
        this.bailBodies = [];   // 2 bails (physics bodies)
    }

    /**
     * Initialize physics world
     */
    init() {
        // Create world with gravity
        this.world = new CANNON.World();
        this.world.gravity.set(0, this.gravity, 0);

        // Improve performance
        this.world.broadphase = new CANNON.NaiveBroadphase();
        this.world.solver.iterations = 5;

        // Create ground
        this.createGround();

        // Create ball
        this.createBall();

        // Create wicket physics bodies
        this.createWicketPhysics();

        console.log('Physics initialized');
        return this;
    }

    /**
     * Create ground plane
     */
    createGround() {
        const groundShape = new CANNON.Plane();
        this.groundBody = new CANNON.Body({
            mass: 0, // Static body
            shape: groundShape,
            material: new CANNON.Material('ground')
        });
        this.groundBody.quaternion.setFromAxisAngle(
            new CANNON.Vec3(1, 0, 0),
            -Math.PI / 2
        );
        this.world.addBody(this.groundBody);
    }

    /**
     * Create ball body
     */
    createBall() {
        const ballShape = new CANNON.Sphere(0.35);
        const ballMaterial = new CANNON.Material('ball');

        this.ballBody = new CANNON.Body({
            mass: this.config.physics.ballMass,  // Fixed: was 'physics.ballMass'
            shape: ballShape,
            material: ballMaterial,
            linearDamping: 0.05,        // Low: ball travels far through air
            angularDamping: 0.1         // Moderate: spin reduces gradually
        });

        // Set initial position (bowling end)
        this.ballBody.position.set(0, 2, -10);

        // Contact material for bounce
        const ballGroundContact = new CANNON.ContactMaterial(
            ballMaterial,
            this.groundBody.material,
            {
                restitution: this.restitution,
                friction: this.friction
            }
        );
        this.world.addContactMaterial(ballGroundContact);

        this.world.addBody(this.ballBody);

        // Bounce tracking
        this.hasBounced = false;
        this.bounceCount = 0;
        this.onSecondBounce = null; // Callback for scoring after 2nd bounce

        this.ballBody.addEventListener('collide', (e) => {
            if (e.body === this.groundBody) {
                const impactVelocity = Math.abs(e.contact.getImpactVelocityAlongNormal());
                if (impactVelocity > 0.5) {
                    this.hasBounced = true;
                    this.bounceCount++;
                    console.log(`🏏 Bounce #${this.bounceCount}: Impact=${impactVelocity.toFixed(1)}m/s`);

                    // Trigger scoring after 2nd bounce
                    if (this.bounceCount === 2 && this.onSecondBounce) {
                        setTimeout(() => {
                            const distance = this.getDistanceFromStumps();
                            console.log(`📊 2nd bounce complete! Distance: ${distance.toFixed(1)}m`);
                            this.onSecondBounce(distance);
                        }, 100); // Small delay to let ball settle after bounce
                    }
                }
            }
        });
    }

    /**
     * Create wicket physics bodies (3 stumps + 2 bails)
     * IMPORTANT: Must match 3x scaled visual wickets in renderer.js
     */
    createWicketPhysics() {
        // Match visual wicket scale (3x)
        const scale = 3.0;
        const stumpSpacing = 0.25 * scale; // 0.75 units apart
        const stumpPositions = [-stumpSpacing, 0, stumpSpacing]; // 3 stumps
        const stumpRadius = 0.12 * scale; // 0.36
        const stumpHeight = 1.5 * scale;  // 4.5 units tall

        // Create 3 stumps
        stumpPositions.forEach((x, i) => {
            const shape = new CANNON.Cylinder(stumpRadius, stumpRadius, stumpHeight, 8);
            const body = new CANNON.Body({
                mass: 6.0, // 6kg per stump (Standard heavy wood)
                position: new CANNON.Vec3(x, stumpHeight / 2, 10), // At batting end (z=10)
                shape: shape
            });

            // Start as KINEMATIC (static, won't move)
            body.type = CANNON.Body.KINEMATIC;

            this.world.addBody(body);
            this.stumpBodies.push(body);
        });

        // Create 2 bails (on top of stumps)
        const bailRadius = 0.05 * scale; // 0.15
        const bailLength = 0.3 * scale;  // 0.9
        for (let i = 0; i < 2; i++) {
            const shape = new CANNON.Box(new CANNON.Vec3(bailLength / 2, bailRadius, bailRadius));
            const body = new CANNON.Body({
                mass: 1.0, // 1kg per bail (Medium-Heavy)
                position: new CANNON.Vec3((i - 0.5) * stumpSpacing, stumpHeight + bailRadius * 2, 10)
            });

            // Start as KINEMATIC
            body.type = CANNON.Body.KINEMATIC;

            this.world.addBody(body);
            this.bailBodies.push(body);
        }

        console.log(`🏏 Wicket physics created: 3 stumps (spacing=${stumpSpacing}, height=${stumpHeight}) + 2 bails`);
    }

    /**
     * Get distance from stumps (batting crease at Z=10)
     */
    getDistanceFromStumps() {
        if (!this.ballBody) return 0;
        const pos = this.ballBody.position;
        const dx = pos.x;
        const dz = pos.z - 10;
        return Math.sqrt(dx * dx + dz * dz);
    }

    /**
     * Check if ball hit the wicket (collision with stump bodies)
     * @returns {Object|null} - Dismissal data or null
     */
    checkWicketCollision() {
        if (!this.ballBody) return null;

        const ballPos = this.ballBody.position;
        const ballVel = this.ballBody.velocity;

        // Check if ball is near wicket area (wider check zone for scaled wickets)
        if (Math.abs(ballPos.z - 10) > 1.5) return null;

        // Debug: Log ball position near wickets
        if (Math.abs(ballPos.z - 10) < 2) {
            console.log(`🏏 Ball near wicket: pos=(${ballPos.x.toFixed(2)}, ${ballPos.y.toFixed(2)}, ${ballPos.z.toFixed(2)})`);
        }

        // Check collision with each stump
        const stumpRadius = 0.36; // Physical stump radius (3x scale)
        const ballRadius = 0.35;  // Ball radius
        const collisionDistance = stumpRadius + ballRadius + 0.3; // ~1.0 for easier collision

        for (let i = 0; i < this.stumpBodies.length; i++) {
            const stump = this.stumpBodies[i];

            // Check horizontal distance (X-axis) to stump center
            const dx = Math.abs(ballPos.x - stump.position.x);

            // Check if ball is at stump height (Y-axis: 0 to stumpHeight=4.5)
            const stumpHeight = 4.5;
            const withinHeight = ballPos.y >= 0 && ballPos.y <= stumpHeight;

            // Check Z position (ball passing through stump line)
            const dz = Math.abs(ballPos.z - 10);

            // Collision check: ball within stump width and at correct height/depth
            if (dx < collisionDistance && dz < 1.0 && withinHeight) {
                console.log(`🔴 BOWLED! Ball hit stump ${i} at speed ${ballVel.length().toFixed(1)} m/s`);
                console.log(`   Position: (${ballPos.x.toFixed(2)}, ${ballPos.y.toFixed(2)}, ${ballPos.z.toFixed(2)})`);
                console.log(`   Stump pos: (${stump.position.x.toFixed(2)}, ${stump.position.y.toFixed(2)}, ${stump.position.z.toFixed(2)})`);

                return {
                    type: 'bowled',
                    stumpIndex: i,
                    impactPoint: ballPos.clone(),
                    impactVelocity: ballVel.clone(),
                    ballSpeed: ballVel.length()
                };
            }
        }

        // Check collision with bails (for top edge hits)
        const bailHeight = 4.5 + 0.15; // Stump height + bail radius
        const bailCollisionDistY = 0.5; // Vertical buffer
        const bailLength = 0.9;

        for (let i = 0; i < this.bailBodies.length; i++) {
            const bail = this.bailBodies[i];
            const ballPos = this.ballBody.position;

            // Check Z depth
            const dz = Math.abs(ballPos.z - 10);

            // Check Height (Y) - must be near the top
            const dy = Math.abs(ballPos.y - bailHeight);

            // Check Horizontal (X) - detect overlap with bail length
            const dx = Math.abs(ballPos.x - bail.position.x);
            const hitWidth = (bailLength / 2) + 0.35; // Half length + ball radius

            if (dz < 1.0 && dy < bailCollisionDistY && dx < hitWidth) {
                console.log(`🔴 BOWLED! Ball hit BAIL ${i}`);
                return {
                    type: 'bowled',
                    stumpIndex: 1, // Default to middle stump for physics impact
                    isBailHit: true,
                    targetBailIndex: i,
                    impactPoint: ballPos.clone(),
                    impactVelocity: this.ballBody.velocity.clone(),
                    ballSpeed: this.ballBody.velocity.length()
                };
            }
        }

        return null;
    }

    /**
     * Destroy wicket - make stumps/bails dynamic and apply forces
     * @param {Object} dismissal - Dismissal data from checkWicketCollision
     */
    destroyWicket(dismissal) {
        console.log('💥 Destroying wicket!', dismissal);

        // Make all stumps and bails DYNAMIC (can move)
        this.stumpBodies.forEach(body => {
            body.type = CANNON.Body.DYNAMIC;
        });
        this.bailBodies.forEach(body => {
            body.type = CANNON.Body.DYNAMIC;
        });

        // Calculate force multiplier based on ball speed
        // Realistic: fast ball at 40m/s should move stump ~3-5m
        const speed = dismissal.ballSpeed;
        let forceMult = 1.0;

        if (speed < 15) {
            forceMult = 0.3; // Slow ball - very gentle
        } else if (speed > 25) {
            forceMult = 1.5; // Fast ball - stronger but not extreme
        }

        console.log(`Ball speed: ${speed.toFixed(1)} m/s, Force multiplier: ${forceMult}x`);

        // Apply realistic force to hit stump
        // Real stumps weigh ~0.5kg, ball ~0.16kg at 40m/s = ~6.4 Ns impulse
        const hitStump = this.stumpBodies[dismissal.stumpIndex];
        const force = dismissal.impactVelocity.clone();
        force.scale(forceMult * 5); // Realistic force (was 50, now 5)

        hitStump.applyImpulse(force, hitStump.position);

        // Bails hop up gently
        this.bailBodies.forEach(bail => {
            bail.applyImpulse(
                new CANNON.Vec3(
                    (Math.random() - 0.5) * 6.2, // Sideways scattering (+- 3.1)
                    2 * forceMult,               // Gentle upward
                    (Math.random() - 0.5) * 6.2  // Forward/back scattering (+- 3.1)
                ),
                bail.position
            );
        });

        // Reset after 3 seconds
        setTimeout(() => this.resetWicket(), 3000);
    }

    /**
     * Reset wicket to original position
     * Uses 3x scale to match visual wickets
     */
    resetWicket() {
        console.log('🔄 Resetting wicket');

        // Match visual wicket scale (3x)
        const scale = 3.0;
        const stumpSpacing = 0.25 * scale; // 0.75
        const stumpHeight = 1.5 * scale;   // 4.5
        const bailRadius = 0.05 * scale;   // 0.15
        const stumpPositions = [-stumpSpacing, 0, stumpSpacing];

        // Reset stumps
        this.stumpBodies.forEach((body, i) => {
            body.position.set(stumpPositions[i], stumpHeight / 2, 10);
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
            body.quaternion.set(0, 0, 0, 1); // Reset rotation
            body.type = CANNON.Body.KINEMATIC; // Back to static
        });

        // Reset bails
        this.bailBodies.forEach((body, i) => {
            body.position.set((i - 0.5) * stumpSpacing, stumpHeight + bailRadius * 2, 10);
            body.velocity.set(0, 0, 0);
            body.angularVelocity.set(0, 0, 0);
            body.quaternion.set(0, 0, 0, 1);
            body.type = CANNON.Body.KINEMATIC;
        });
    }

    /**
     * Check if ball crossed boundary rope
     * Uses GAME_CONFIG.scoring.boundaryRope for the distance
     */
    checkBoundary(distance) {
        return distance >= this.config.scoring.boundaryRope;
    }

    /**
     * Reset ball to bowling position
     */
    resetBall(x = 0, y = 2, z = -10) {
        this.ballBody.position.set(x, y, z);
        this.ballBody.velocity.set(0, 0, 0);
        this.ballBody.angularVelocity.set(0, 0, 0);
        this.hasBounced = false;
        this.bounceCount = 0;
    }

    /**
     * Bowl the ball with given parameters
     */
    bowl(options = {}) {
        const {
            speed = 30,      // m/s (about 108 km/h)
            line = 0,        // x offset (-1 to 1)
            length = 0.5,    // 0 = short, 1 = full
            spin = 0,        // lateral spin
            swing = 0        // air movement
        } = options;

        // Reset ball position with line offset
        const startX = line * 0.5;
        this.resetBall(startX, 2.5, -10);

        // Calculate velocity components
        // Z velocity (towards batsman)
        const vz = speed * 0.9;

        // Y velocity (arc based on length)
        // Short = higher arc, Full = flatter
        const vy = speed * (0.3 - length * 0.2);

        // X velocity (swing)
        const vx = swing * 5;

        // Apply velocity
        this.ballBody.velocity.set(vx, vy, vz);

        // Apply spin (angular velocity)
        this.ballBody.angularVelocity.set(
            spin * 20,  // Side spin
            0,
            speed * 0.5 // Forward spin
        );
    }

    /**
     * Apply hit force to ball - EXIT VELOCITY PHYSICS
     * 
     * Uses GAME_CONFIG for tunable coefficients.
     * Zone affects both power AND trajectory angle.
     * 
     * @param {Object} direction - Direction vector {x, y, z}
     * @param {number} batSpeed - Bat speed in m/s (0-20)
     * @param {number} zoneMultiplier - Zone power multiplier (0.05 to 1.0)
     * @param {number} deflection - Horizontal deflection for edge hits
     * @param {number} bowlSpeed - Incoming bowl speed in m/s (22-44)
     * @param {number} launchAngle - Base launch angle in degrees
     * @param {number} timingMultiplier - Timing quality (0.35 to 1.30)
     * @param {string} zoneName - Name of bat zone hit (for angle modifier)
     */
    hit(direction, batSpeed = 5, zoneMultiplier = 1.0, deflection = 0, bowlSpeed = 30, launchAngle = 22, timingMultiplier = 1.0, zoneName = 'middle') {
        let { x, y, z } = direction;

        // Get physics config
        const { physics } = this.config;

        // === RESET BALL VELOCITY ===
        this.ballBody.velocity.set(0, 0, 0);
        this.ballBody.angularVelocity.set(0, 0, 0);

        // Reset bounce tracking for this hit
        this.hasBounced = false;
        this.bounceCount = 0;

        // Apply edge deflection
        x += deflection;

        // === ZONE-BASED ANGLE MODIFIER ===
        // Different bat zones change the trajectory:
        // - Shoulder/top edge: ball pops UP
        // - Middle: clean intended trajectory
        // - Lower/toe: ball stays LOW
        const angleModifier = getZoneAngleModifier(zoneName);
        const adjustedAngle = Math.max(2, Math.min(55, launchAngle + angleModifier));

        // === EXIT VELOCITY CALCULATION ===
        // Real cricket: bat speeds 25-40 m/s, ball exits at 25-55 m/s
        const batEnergy = Math.pow(batSpeed, 2) * physics.batEnergyCoefficient;
        const reboundEnergy = bowlSpeed * physics.reboundEnergyCoefficient;
        const totalEnergy = (batEnergy + reboundEnergy) * zoneMultiplier * timingMultiplier;

        // Exit velocity
        let exitVelocity = Math.sqrt(Math.max(totalEnergy, 1.0)) * physics.powerBoost;

        // Cap exit velocity to realistic range (10-45 m/s)
        exitVelocity = Math.min(45, Math.max(5, exitVelocity));

        // === REALISTIC CRICKET TRAJECTORY ===
        // In cricket, most shots are LOW and FAST (ground shots travel along ground)
        // Only lofted shots go high (sixes)
        // Launch angle: 5° (ground shot) to 35° (lofted six)

        const angleRad = (adjustedAngle * Math.PI) / 180;

        // CRITICAL: In cricket, HORIZONTAL velocity dominates
        // cos(20°) = 0.94, sin(20°) = 0.34 → mostly horizontal
        let forwardVelocity = Math.cos(angleRad) * exitVelocity;  // Main component
        let upwardVelocity = Math.sin(angleRad) * exitVelocity;   // Secondary
        let sidewaysVelocity = x * exitVelocity * 0.4;            // Direction control

        // === ZONE-SPECIFIC MODIFICATIONS ===
        if (zoneName === 'shoulder' || zoneName === 'handle') {
            // Top edge: weak pop-up (catches in air)
            forwardVelocity *= 0.3;
            upwardVelocity = 4.0 + Math.random() * 2;  // Loopy catch
            sidewaysVelocity *= 0.5;
        } else if (zoneName === 'toe') {
            // Toe: jammed into ground, skids along
            forwardVelocity *= 0.6;
            upwardVelocity = 0.8;  // Very low trajectory
        } else if (zoneName.includes('edge')) {
            // Edge: deflected sideways/backward
            forwardVelocity *= 0.4;
            upwardVelocity *= 0.6;
            sidewaysVelocity = (deflection + (Math.random() - 0.5) * 2) * exitVelocity * 0.5;
        } else if (zoneName === 'middle') {
            // Sweet spot: clean hit, maximum forward momentum
            forwardVelocity *= 1.0;  // Full power forward
        }

        // Ensure ball doesn't go underground
        upwardVelocity = Math.max(0.3, upwardVelocity);

        // Ensure ball goes FORWARD (towards boundary)
        forwardVelocity = Math.max(3.0, forwardVelocity);

        // === SET VELOCITY DIRECTLY ===
        // CRITICAL FIX: applyImpulse divides by mass, making ball go ~6x faster!
        // We want the calculated velocity to BE the actual ball velocity
        // Coordinate system:
        // X = sideways (positive = off-side/right, negative = leg-side/left)
        // Y = upward
        // Z = forward (NEGATIVE Z = towards boundary where bowler is at -Z)
        this.ballBody.velocity.set(
            sidewaysVelocity,      // Sideways direction
            upwardVelocity,        // Upward trajectory
            -forwardVelocity       // NEGATIVE = forward to boundary
        );

        // Add realistic spin (affects trajectory after bounce)
        const spinX = (Math.random() - 0.5) * 5;  // Side spin
        const spinY = batSpeed * 0.3;              // Top/back spin
        const spinZ = (Math.random() - 0.5) * 3;  // Gyroscopic
        this.ballBody.angularVelocity.set(spinX, spinY, spinZ);

        // Log with realistic cricket terminology
        const shotType = adjustedAngle > 25 ? 'LOFTED' : 'GROUND';
        console.log(`🏏 HIT: ${zoneName} | ${shotType} | Exit=${exitVelocity.toFixed(1)}m/s | Fwd=${forwardVelocity.toFixed(1)} Up=${upwardVelocity.toFixed(1)} Side=${sidewaysVelocity.toFixed(1)}`);
    }

    /**
     * Calculate swing force based on ball speed and type
     * @param {number} speed - Ball speed in m/s
     * @param {string} swingType - 'inswing', 'outswing', 'none'
     * @param {number} ballAge - 0 (new) to 1 (old)
     * @returns {Object} - {x: lateral force, strength: 0-1, isReverse: boolean}
     */
    calculateSwingForce(speed, swingType, ballAge = 0) {
        if (swingType === 'none' || !this.config.physics.swing.enabled) {
            return { x: 0, strength: 0, isReverse: false };
        }

        const { speedRanges, maxDeviation, curveExponent } = this.config.physics.swing;

        // Determine swing type based on speed
        let swingStrength = 0;
        let isReverse = false;

        if (speed >= speedRanges.conventional.min &&
            speed <= speedRanges.conventional.max) {
            // Conventional swing (optimal range: 70-85 mph)
            const midSpeed = (speedRanges.conventional.min + speedRanges.conventional.max) / 2;
            const speedFactor = 1 - Math.abs(speed - midSpeed) / midSpeed;
            swingStrength = speedFactor * (1 - ballAge * 0.5);

        } else if (speed > speedRanges.reverse.min) {
            // Reverse swing (high speed + old ball)
            swingStrength = ballAge * 0.8; // Needs worn ball
            isReverse = true;
        }

        // Calculate lateral deviation
        const maxDev = isReverse ? maxDeviation.reverse : maxDeviation.conventional;
        const lateralForce = maxDev * swingStrength;

        // Direction: inswing = negative X (towards batsman/leg side)
        //            outswing = positive X (away from batsman/off side)
        let direction = 1;
        if (swingType === 'inswing') {
            direction = isReverse ? 1 : -1; // Reverse flips direction
        } else if (swingType === 'outswing') {
            direction = isReverse ? -1 : 1;
        }

        return {
            x: lateralForce * direction,
            strength: swingStrength,
            isReverse: isReverse
        };
    }

    /**
     * Get flight progress (0 = bowler end, 1 = batsman end)
     */
    getFlightProgress() {
        const startZ = -10;  // Bowler end
        const endZ = 10;     // Batsman end
        const currentZ = this.ballBody.position.z;

        return Math.max(0, Math.min(1, (currentZ - startZ) / (endZ - startZ)));
    }

    /**
     * Update physics simulation with ground friction
     */
    update(deltaTime = 1 / 60) {
        this.world.step(deltaTime);

        // === SWING FORCE (DURING FLIGHT) ===
        // Apply swing force if ball is in air and swing is enabled
        if (this.ballBody && this.ballBody.position.y > 0.5 && this.swingEnabled) {
            const speed = this.ballBody.velocity.length();
            const swing = this.calculateSwingForce(
                speed,
                this.currentSwingType,
                this.ballAge
            );

            // Apply lateral force (swing happens gradually)
            // Use curve to make swing happen later in flight (more realistic)
            const flightProgress = this.getFlightProgress(); // 0 to 1
            const swingCurve = Math.pow(flightProgress, this.config.physics.swing.curveExponent);

            const swingForce = new CANNON.Vec3(
                swing.x * swingCurve * 10, // Lateral (X-axis)
                0,                          // No vertical
                0                           // No forward/back
            );

            this.ballBody.applyForce(swingForce, this.ballBody.position);

            // Visual indicator (log once when swing is significant)
            if (swing.strength > 0.3 && flightProgress > 0.3 && flightProgress < 0.35) {
                console.log(`🌪️ ${swing.isReverse ? 'REVERSE' : 'CONVENTIONAL'} ${this.currentSwingType.toUpperCase()}! Strength: ${(swing.strength * 100).toFixed(0)}%`);
            }
        }

        // === GROUND FRICTION ===
        // Apply friction ONLY when ball is on ground (y ≈ ball radius 0.35)
        // AND vertical velocity is low (not bouncing)
        if (this.ballBody && this.ballBody.position.y < 0.4 && Math.abs(this.ballBody.velocity.y) < 1.0) {
            const vel = this.ballBody.velocity;
            const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

            // Use friction from config
            if (speed > 0.1) {
                const friction = this.config.physics.friction.rolling * deltaTime;
                const factor = Math.max(0, 1 - friction / speed);
                vel.x *= factor;
                vel.z *= factor;
            } else {
                // Ball has stopped
                vel.x = 0;
                vel.z = 0;
            }
        }
    }

    /**
     * Get ball position
     */
    getBallPosition() {
        return {
            x: this.ballBody.position.x,
            y: this.ballBody.position.y,
            z: this.ballBody.position.z
        };
    }

    /**
     * Get ball velocity
     */
    getBallVelocity() {
        return {
            x: this.ballBody.velocity.x,
            y: this.ballBody.velocity.y,
            z: this.ballBody.velocity.z
        };
    }

    /**
     * Check if ball has stopped
     */
    isBallStopped() {
        const vel = this.ballBody.velocity;
        const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
        return speed < 0.5;
    }

    /**
     * Check if ball passed batsman
     */
    hasBallPassedBatsman() {
        return this.ballBody.position.z > 12;
    }

    /**
     * Check if ball is in hitting zone
     * Uses GAME_CONFIG.hittingZone for consistent zone definition
     */
    isInHittingZone() {
        const pos = this.ballBody.position;
        const zone = this.config.hittingZone;
        return pos.z > zone.minZ && pos.z < zone.maxZ &&
            pos.y > zone.minY && pos.y < zone.maxY;
    }

    /**
     * Calculate where ball will end up (for scoring)
     */
    predictLandingZone() {
        const pos = this.getBallPosition();

        // Use correct distance from batting crease
        const distance = this.getDistanceFromStumps();

        // Determine zone based on angle
        const angle = Math.atan2(pos.x, -pos.z) * (180 / Math.PI);

        let zone = 'straight';
        if (angle > 30) zone = 'offside';
        else if (angle < -30) zone = 'onside';

        return { distance, zone, angle };
    }
}
