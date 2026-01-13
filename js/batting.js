/**
 * Batting Module - Authentic Cricket Shots using Clock Face Method
 * 
 * Clock Face Directions (for right-handed batter):
 * - 12 o'clock: Straight behind bowler (Straight Drive)
 * - 3 o'clock: Off-side (Point/Cover)
 * - 9 o'clock: On-side/Leg-side (Square Leg/Mid-wicket)
 * - 6 o'clock: Behind the batter (Wicketkeeper area)
 */

export class Batting {
    constructor() {
        // Hand tracking data
        this.handPosition = null;
        this.handVelocity = { x: 0, y: 0, z: 0 };
        this.previousPositions = [];
        this.allFingerTips = [];
        this.handBounds = null;

        // Swing detection
        this.isSwinging = false;
        this.swingStartTime = 0;
        this.swingDirection = null;
        this.swingSpeed = 0;

        // Hit zone (normalized 0-1)
        this.hitZone = {
            minX: 0.1,
            maxX: 0.9,
            minY: 0.1,
            maxY: 0.9
        };

        this.swingThreshold = 0.8;

        /**
         * Authentic Cricket Shots with Clock Face Directions and Launch Angles
         * Direction vectors: x = left/right, y = height, z = forward/back
         * Positive x = Off-side (right), Negative x = Leg-side (left)
         * Positive z = towards boundary (12 o'clock), Negative z = towards wicketkeeper (6 o'clock)
         * Launch Angles: Defensive 8°, Drives 22°, Cuts 28°, Pulls 35°, Lofts 45°
         */
        this.shots = {
            // 1. Forward Defensive - Ball drops at feet (12 o'clock, minimal power)
            'forward-defensive': {
                name: 'Forward Defensive',
                clockPosition: 12,
                direction: { x: 0, y: 0.1, z: 0.3 },
                power: 0.15,
                launchAngle: 8,  // Low angle - ball stays along ground
                description: 'Safety shot - kills the ball speed'
            },

            // 2. Square Cut - Off-side, horizontal bat (2-3 o'clock)
            'square-cut': {
                name: 'Square Cut',
                clockPosition: 3,
                direction: { x: 1.5, y: 0.3, z: 0.2 },
                power: 0.85,
                launchAngle: 28,  // Medium-high - powerful horizontal
                description: 'Powerful horizontal hit to Point/Backward Point'
            },

            // 3. On Drive - Straight/Leg side (10-11 o'clock)
            'on-drive': {
                name: 'On Drive',
                clockPosition: 10.5,
                direction: { x: -0.5, y: 0.5, z: 1.2 },
                power: 0.9,
                launchAngle: 22,  // Classic drive angle
                description: 'Elegant drive toward Mid-on'
            },

            // 4. Pull Shot - Deep Leg-side (8-9 o'clock)
            'pull-shot': {
                name: 'Pull Shot',
                clockPosition: 8.5,
                direction: { x: -1.5, y: 0.4, z: 0.3 },
                power: 0.95,
                launchAngle: 35,  // Higher arc for pull
                description: 'Response to bouncer - whipped to Square Leg'
            },

            // 5. Late Cut - Behind wicket (4-5 o'clock)
            'late-cut': {
                name: 'Late Cut',
                clockPosition: 4.5,
                direction: { x: 1.2, y: 0.2, z: -0.5 },
                power: 0.6,
                launchAngle: 20,  // Lower angle - touch shot
                description: 'Touch shot past slip to Third Man'
            },

            // Additional common shots
            'straight-drive': {
                name: 'Straight Drive',
                clockPosition: 12,
                direction: { x: 0, y: 0.6, z: 1.5 },
                power: 0.95,
                launchAngle: 25,  // Classic drive trajectory
                description: 'Classic drive straight past bowler'
            },

            'cover-drive': {
                name: 'Cover Drive',
                clockPosition: 1.5,
                direction: { x: 0.8, y: 0.5, z: 1.2 },
                power: 0.9,
                launchAngle: 22,  // Elegant drive angle
                description: 'Elegant drive through covers'
            },

            'flick': {
                name: 'Flick',
                clockPosition: 9,
                direction: { x: -1, y: 0.4, z: 0.8 },
                power: 0.75,
                launchAngle: 28,  // Wristy flick - bit of loft
                description: 'Wristy flick to Mid-wicket'
            },

            'miss': {
                name: 'Miss!',
                clockPosition: 0,
                direction: { x: 0, y: 0, z: 0 },
                power: 0,
                launchAngle: 0,
                description: 'Missed the ball'
            }
        };
    }

    /**
     * Update with full hand landmarks (all 21 points)
     */
    updateWithLandmarks(landmarks) {
        if (!landmarks || landmarks.length < 21) return;

        this.allFingerTips = [
            landmarks[4], landmarks[8], landmarks[12], landmarks[16], landmarks[20]
        ];

        this.calculateHandBounds();

        const palmCenter = landmarks[9];
        const prevPosition = this.handPosition;
        this.handPosition = { x: palmCenter.x, y: palmCenter.y, z: palmCenter.z || 0 };

        if (prevPosition) {
            const dt = 1 / 30;
            this.handVelocity = {
                x: (this.handPosition.x - prevPosition.x) / dt,
                y: (this.handPosition.y - prevPosition.y) / dt,
                z: (this.handPosition.z - prevPosition.z) / dt
            };
        }

        this.previousPositions.push({ position: { ...this.handPosition }, timestamp: Date.now() });
        if (this.previousPositions.length > 15) this.previousPositions.shift();

        this.detectSwing();
    }

    calculateHandBounds() {
        if (this.allFingerTips.length < 5) return;

        let minX = 1, maxX = 0, minY = 1, maxY = 0;
        for (const tip of this.allFingerTips) {
            minX = Math.min(minX, tip.x);
            maxX = Math.max(maxX, tip.x);
            minY = Math.min(minY, tip.y);
            maxY = Math.max(maxY, tip.y);
        }

        const padding = 0.05;
        this.handBounds = {
            minX: minX - padding, maxX: maxX + padding,
            minY: minY - padding, maxY: maxY + padding,
            centerX: (minX + maxX) / 2, centerY: (minY + maxY) / 2,
            width: maxX - minX + padding * 2, height: maxY - minY + padding * 2
        };
    }

    updateHandPosition(position, velocity) {
        if (!position) return;
        this.previousPositions.push({ position: { ...position }, timestamp: Date.now() });
        if (this.previousPositions.length > 15) this.previousPositions.shift();
        this.handPosition = position;
        this.handVelocity = velocity;
        this.detectSwing();
    }

    detectSwing() {
        this.swingSpeed = Math.sqrt(this.handVelocity.x ** 2 + this.handVelocity.y ** 2);

        if (this.swingSpeed > this.swingThreshold && !this.isSwinging) {
            this.isSwinging = true;
            this.swingStartTime = Date.now();
            this.swingDirection = this.calculateSwingDirection();
            console.log('🏏 Swing detected!', { speed: this.swingSpeed.toFixed(2), direction: this.swingDirection });
        } else if (this.swingSpeed < this.swingThreshold * 0.3 && this.isSwinging) {
            this.isSwinging = false;
        }
    }

    calculateSwingDirection() {
        const vx = this.handVelocity.x;
        const vy = this.handVelocity.y;
        if (Math.abs(vx) > Math.abs(vy)) {
            return vx > 0 ? 'offside' : 'legside';
        }
        return vy > 0 ? 'down' : 'up';
    }

    isInHitPosition() {
        if (this.handBounds) {
            const hb = this.handBounds;
            const hz = this.hitZone;
            return hb.maxX > hz.minX && hb.minX < hz.maxX && hb.maxY > hz.minY && hb.minY < hz.maxY;
        }
        if (!this.handPosition) return false;
        const { x, y } = this.handPosition;
        return x >= this.hitZone.minX && x <= this.hitZone.maxX &&
            y >= this.hitZone.minY && y <= this.hitZone.maxY;
    }

    /**
     * Determine shot type based on hand velocity direction
     * Uses clock face method for accurate shot selection
     */
    calculateShot(ballPosition) {
        if (!this.handPosition) return this.shots['miss'];
        if (!this.isSwinging && this.swingSpeed < 0.3) return this.shots['miss'];

        const vx = this.handVelocity.x;
        const vy = this.handVelocity.y;
        const speed = this.swingSpeed;

        // Determine shot based on hand movement direction and speed
        // THRESHOLDS LOWERED for easier shot variety with hand tracking
        let shotKey = 'forward-defensive';

        if (speed > 1.0) {
            // Fast swing - aggressive shot (was > 2.5)
            if (vx > 0.4) {
                // Moving right = Off-side (was > 1)
                shotKey = vy < -0.3 ? 'cover-drive' : 'square-cut';
            } else if (vx < -0.4) {
                // Moving left = Leg-side (was < -1)
                shotKey = vy < -0.3 ? 'on-drive' : 'pull-shot';
            } else if (vy < -0.5) {
                // Moving up = Lofted straight
                shotKey = 'lofted-straight';
            } else if (vy > 0.3) {
                // Moving down = Late timing
                shotKey = vx > 0.2 ? 'late-cut' : 'flick';
            } else {
                shotKey = 'straight-drive';
            }
        } else if (speed > 0.5) {
            // Medium swing (was > 1.5)
            if (vx > 0.3) {
                shotKey = 'cover-drive';
            } else if (vx < -0.3) {
                shotKey = 'flick';
            } else {
                shotKey = 'straight-drive';
            }
        } else if (speed > 0.2) {
            // Slow = Defensive (was > 0.5)
            shotKey = 'forward-defensive';
        }

        const shot = { ...this.shots[shotKey] };
        shot.power = Math.min(speed / 3, 1);
        return shot;
    }

    /**
     * Get hit direction vector for physics
     */
    getHitDirection() {
        const vx = this.handVelocity.x;
        const vy = this.handVelocity.y;

        // Map hand velocity to 3D direction
        const direction = {
            x: -vx * 2.0,  // Invert for mirrored camera
            y: Math.max(0.2, 0.6 - vy * 0.4),
            z: 1.2
        };

        const magnitude = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
        return {
            x: direction.x / magnitude,
            y: direction.y / magnitude,
            z: direction.z / magnitude
        };
    }

    /**
     * Get clock position description for a shot
     */
    getClockDescription(clockPos) {
        const positions = {
            12: 'Straight (12 o\'clock)',
            1: 'Cover region (1 o\'clock)',
            1.5: 'Cover region (1-2 o\'clock)',
            2: 'Point region (2 o\'clock)',
            3: 'Point/Backward Point (3 o\'clock)',
            4: 'Third Man region (4 o\'clock)',
            4.5: 'Third Man (4-5 o\'clock)',
            5: 'Fine leg region (5 o\'clock)',
            6: 'Behind wicket (6 o\'clock)',
            7: 'Fine leg (7 o\'clock)',
            8: 'Square leg (8 o\'clock)',
            8.5: 'Square Leg (8-9 o\'clock)',
            9: 'Square Leg/Mid-wicket (9 o\'clock)',
            10: 'Mid-wicket (10 o\'clock)',
            10.5: 'Mid-on region (10-11 o\'clock)',
            11: 'Mid-on (11 o\'clock)'
        };
        return positions[clockPos] || `${clockPos} o'clock`;
    }


    getSwingData() {
        return {
            isSwinging: this.isSwinging,
            speed: this.swingSpeed,
            direction: this.swingDirection,
            handBounds: this.handBounds
        };
    }

    reset() {
        this.isSwinging = false;
        this.swingDirection = null;
        this.swingSpeed = 0;
        this.previousPositions = [];
    }
}
