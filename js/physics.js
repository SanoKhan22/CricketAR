/**
 * Physics Module - Cannon-es physics world
 */

import * as CANNON from 'cannon-es';

export class Physics {
    constructor() {
        this.world = null;
        this.ballBody = null;
        this.groundBody = null;

        // Physics settings
        this.gravity = -9.82;
        this.restitution = 0.3; // REDUCED: 2nd bounce small, 3rd tiny
        this.friction = 0.3;
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
            mass: 0.163, // Cricket ball ~163g
            shape: ballShape,
            material: ballMaterial,
            linearDamping: 0.1,
            angularDamping: 0.1
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
     * Check if ball crossed boundary
     */
    checkBoundary(distance) {
        return distance > 60;
    }
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
     * Apply hit force to ball - EXIT VELOCITY PHYSICS with LOWER coefficients
     * 
     * Formula:
     *   BatEnergy = BatSpeed² × 0.15 (REDUCED from 0.35)
     *   ReboundEnergy = BowlSpeed × 0.03 (REDUCED from 0.12)
     *   TotalEnergy = (BatEnergy + ReboundEnergy) × ZoneMultiplier × TimingMultiplier
     *   ExitVelocity = √(TotalEnergy)
     * 
     * @param {Object} direction - Direction vector {x, y, z}
     * @param {number} batSpeed - Bat speed in m/s (0-20)
     * @param {number} zoneMultiplier - Zone power multiplier (0.1 to 1.0)
     * @param {number} deflection - Horizontal deflection for edge hits
     * @param {number} bowlSpeed - Incoming bowl speed in m/s (22-44)
     * @param {number} launchAngle - Launch angle in degrees (8-45)
     * @param {number} timingMultiplier - Timing quality (0.4 to 1.2)
     */
    hit(direction, batSpeed = 5, zoneMultiplier = 1.0, deflection = 0, bowlSpeed = 30, launchAngle = 22, timingMultiplier = 1.0) {
        let { x, y, z } = direction;

        // Apply edge deflection
        x += deflection;

        // === EXIT VELOCITY PHYSICS - LOWER COEFFICIENTS ===

        // Bat energy: REDUCED coefficient so weak hits don't fly
        // Weak hit (5 m/s): 25 × 0.15 = 3.75
        // Power hit (18 m/s): 324 × 0.15 = 48.6
        const batEnergy = Math.pow(batSpeed, 2) * 0.15;

        // Rebound energy: MUCH LOWER so ball doesn't auto-fly
        // Fast bowl (40 m/s): 40 × 0.03 = 1.2
        const reboundEnergy = bowlSpeed * 0.03;

        // Total energy with zone and timing adjustments
        const totalEnergy = (batEnergy + reboundEnergy) * zoneMultiplier * timingMultiplier;

        // Exit velocity = sqrt of energy
        const exitVelocity = Math.sqrt(totalEnergy);

        // === LAUNCH ANGLE TRAJECTORY ===
        const angleRad = (launchAngle * Math.PI) / 180;

        // Velocity components
        const horizontalVelocity = Math.cos(angleRad) * exitVelocity;
        let verticalVelocity = Math.sin(angleRad) * exitVelocity;

        // Weak zone hits: reduce effectiveness, add pop-up
        if (zoneMultiplier < 0.5) {
            verticalVelocity = Math.abs(verticalVelocity) * 0.5 + 1.5;
        }

        // Minimum vertical to prevent underground
        verticalVelocity = Math.max(0.5, verticalVelocity);

        // Apply impulse to ball
        const impulse = new CANNON.Vec3(
            x * horizontalVelocity * 1.2,    // Side direction
            verticalVelocity,                 // Vertical
            -z * horizontalVelocity * 1.0     // Forward (towards boundary)
        );

        this.ballBody.applyImpulse(impulse, this.ballBody.position);

        console.log(`🏏 Exit: BatSpeed=${batSpeed.toFixed(1)}, BatEng=${batEnergy.toFixed(1)}, Rebound=${reboundEnergy.toFixed(1)}, Zone=${zoneMultiplier.toFixed(2)}, Timing=${timingMultiplier}x → Velocity=${exitVelocity.toFixed(1)}m/s, Angle=${launchAngle}°`);
    }

    /**
     * Update physics simulation with ground friction
     */
    update(deltaTime = 1 / 60) {
        this.world.step(deltaTime);

        // === GROUND FRICTION ===
        // Apply friction ONLY when ball is on ground (y ≈ ball radius 0.35)
        // AND vertical velocity is low (not bouncing)
        if (this.ballBody && this.ballBody.position.y < 0.4 && Math.abs(this.ballBody.velocity.y) < 1.0) {
            const vel = this.ballBody.velocity;
            const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);

            // Strong friction (15 m/s² deceleration)
            if (speed > 0.1) {
                const friction = 15.0 * deltaTime;
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
     * Check if ball is in hitting zone - extended zone for easier gameplay
     */
    isInHittingZone() {
        const pos = this.ballBody.position;
        // Hitting zone: z between 5 and 12, y between 0 and 4 (generous zone)
        return pos.z > 5 && pos.z < 12 && pos.y > 0 && pos.y < 4;
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
