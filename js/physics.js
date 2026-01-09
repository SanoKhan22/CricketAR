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
        this.restitution = 0.6; // Bounce factor
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
    }

    /**
     * Reset ball to bowling position
     */
    resetBall(x = 0, y = 2, z = -10) {
        this.ballBody.position.set(x, y, z);
        this.ballBody.velocity.set(0, 0, 0);
        this.ballBody.angularVelocity.set(0, 0, 0);
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
     * Apply hit force to ball - stronger force for more dramatic shots
     */
    hit(direction, power = 1) {
        const { x, y, z } = direction;

        // Calculate impulse based on power (0-1) - increased for better visibility
        const force = 35 * power;

        const impulse = new CANNON.Vec3(
            x * force * 1.5,              // Side direction
            Math.abs(y) * force * 0.8 + 8, // More upward force
            -z * force * 1.2              // Forward (negative z = towards boundary)
        );

        this.ballBody.applyImpulse(impulse, this.ballBody.position);
        console.log('Hit applied:', { direction, power, force: force.toFixed(1) });
    }

    /**
     * Update physics simulation
     */
    update(deltaTime = 1 / 60) {
        this.world.step(deltaTime);
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
        const vel = this.getBallVelocity();

        // Simple prediction based on current trajectory
        const distance = Math.sqrt(pos.x ** 2 + pos.z ** 2);

        // Determine zone based on angle
        const angle = Math.atan2(pos.x, -pos.z) * (180 / Math.PI);

        let zone = 'straight';
        if (angle > 30) zone = 'offside';
        else if (angle < -30) zone = 'onside';

        return { distance, zone, angle };
    }
}
