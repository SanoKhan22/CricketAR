/**
 * Game Configuration - Centralized constants for Cricket AR
 * 
 * All physics, gameplay, and balance values in one place.
 * This is the SINGLE SOURCE OF TRUTH for all game constants.
 */

export const GAME_CONFIG = {
    // ===========================================
    // FIELD DIMENSIONS
    // ===========================================
    field: {
        // Boundary distances (meters from batting crease)
        boundaryRope: 65,       // Where the rope is placed
        innerCircle: 30,        // 30-yard circle (powerplay)
        pitchLength: 22,        // Wicket to wicket

        // Stadium visual size
        groundRadius: 67,       // Visual ground size
        stadiumRadius: 80       // Seating starts here
    },

    // ===========================================
    // PHYSICS SETTINGS
    // ===========================================
    physics: {
        gravity: -9.82,
        ballMass: 0.163,        // Cricket ball weight in kg
        ballRadius: 0.35,       // 35cm radius (visual scaling for AR visibility)

        // Bounce behavior - realistic cricket
        // Lower restitution = ball loses more energy on bounce
        restitution: {
            pitch: 0.20,        // REDUCED: Lower bounce
            outfield: 0.15,     // REDUCED: Grass absorbs energy
            boundary: 0.10      // Minimal bounce at cushion
        },
        friction: {
            pitch: 0.45,        // INCREASED: More grip stops ball faster
            outfield: 0.40,     // INCREASED: Grass friction
            rolling: 12.0       // INCREASED: Ball stops faster
        },

        // Air resistance
        airDrag: 0.02,

        // === EXIT VELOCITY FORMULA ===
        // ExitVelocity = sqrt((BatSpeed² × batEnergy) + (BowlSpeed × reboundEnergy)) × zone × timing × powerBoost
        //
        // NOW THAT IMPULSE BUG IS FIXED, recalibrate for proper distances:
        // Hand tracking bat speed: typically 0.5-3.0 m/s
        // Need to amplify to get full range of shots
        //
        batEnergyCoefficient: 0.40,     // Adjusted for exponential scaling
        reboundEnergyCoefficient: 0.12, // Increased slightly for pace response
        powerBoost: 3.0,                // Balanced for new 1.8x max factor

        // Bowl speed affects control (faster = harder to time/control)
        // Fast bowl: less control, but more rebound energy if timed right
        bowlSpeedPenalty: {
            slow: 1.0,      // Full control
            medium: 0.92,   // Slight penalty
            fast: 0.82,     // Harder to control
            express: 0.70   // Very hard to time
        },

        // === BALL SWING PHYSICS ===
        // Based on real cricket aerodynamics
        swing: {
            enabled: true,

            // Swing strength based on speed (m/s)
            // 1 m/s ≈ 3.6 km/h
            speedRanges: {
                noSwing: { min: 0, max: 20 },       // Too slow (<72 km/h)
                conventional: { min: 20, max: 38 }, // 72-137 km/h (OPTIMAL)
                reverse: { min: 38, max: 50 }       // >137 km/h (high speed)
            },

            // Maximum lateral deviation (meters)
            maxDeviation: {
                conventional: 0.7,  // 70cm swing at peak
                reverse: 0.5        // 50cm reverse swing
            },

            // Seam angle effect (degrees) - optimal is ~20°
            seamAngle: 20,

            // Swing curve shape (how quickly it swings)
            // Higher = later swing (more realistic)
            curveExponent: 2.5,

            // Ball age effect (0 = new, 1 = old)
            ballAge: {
                new: 1.0,      // 100% conventional swing
                worn: 0.5,     // 50% conventional, enables reverse
                old: 0.2       // 20% conventional, strong reverse
            }
        }
    },

    // ===========================================
    // BAT PHYSICS - Zone effects on trajectory
    // ===========================================
    batZones: {
        // === Vertical zones (from handle to toe) ===
        // Each zone affects: power, launch angle modifier, and description
        handle: {
            start: 0, end: 0.15,
            multiplier: 0.05,
            angleModifier: 0,        // No shot
            description: 'No shot - handle!'
        },
        shoulder: {
            start: 0.15, end: 0.30,
            multiplier: 0.30,
            angleModifier: +20,      // Ball pops UP (high catch risk)
            description: 'Top edge - pops up!'
        },
        middle: {
            start: 0.30, end: 0.65,
            multiplier: 1.00,
            angleModifier: 0,        // Clean hit - intended trajectory
            description: 'Sweet spot - POWER!'
        },
        lower: {
            start: 0.65, end: 0.85,
            multiplier: 0.70,
            angleModifier: -8,       // Ball goes DOWN (stays low)
            description: 'Lower blade - stays low'
        },
        toe: {
            start: 0.85, end: 1.00,
            multiplier: 0.40,
            angleModifier: -15,      // Ball drills into ground
            description: 'Toe - jammed into ground'
        },

        // === Horizontal zones (edges) ===
        edgeWidth: 0.08,            // 8% of blade width = edge
        edgeMultiplier: 0.40,       // Reduced power
        edgeDeflection: 0.7,        // Deflects sideways/backward
        leftEdgeAngle: -60,         // Deflection to leg side
        rightEdgeAngle: +60         // Deflection to off side
    },

    // ===========================================
    // COLLISION DETECTION
    // ===========================================
    collision: {
        // Distance thresholds (meters)
        hitThreshold: 1.3,      // Bat-ball collision distance (Generous for AR)

        // Timing zones (based on Z-axis precision)
        // Relaxed for AR latency (was 0.12, 0.22, 0.35)
        perfectZone: 0.25,      // PERFECT: 25cm window (Easier to hit)
        goodZone: 0.45,         // Good: 45cm window
        okayZone: 0.70,         // Okay: 70cm window

        // Timing multipliers
        timingMultipliers: {
            perfect: 1.10,      // Bonus for perfect timing
            good: 1.0,          // Standard
            okay: 0.65,         // Penalized
            poor: 0.35          // Badly mistimed
        },

        // Bat speed categories (m/s)
        batSpeedCategories: {
            // EXPONENTIAL SCALING: Soft hands = dead ball, Hard hands = huge power
            block: { max: 3, factor: 0.05 },      // 0.05: Dead drop (defensive)
            placement: { max: 6, factor: 0.25 },  // 0.25: Soft push (singles)
            attacking: { max: 10, factor: 0.60 }, // 0.60: Firm stroke (boundaries?)
            power: { max: 15, factor: 1.0 },      // 1.00: Standard power hit
            maximum: { max: 20, factor: 1.8 }     // 1.80: HUGE hit (Sixes)
        }
    },

    // ===========================================
    // SCORING - Single source of truth
    // ===========================================
    scoring: {
        // Boundary definitions
        // Boundary definitions
        // Uses field.boundaryRope as single source of truth (65m)

        // === SCORING RULES ===
        // SIX: Ball CLEARS boundary (>= 65m) WITHOUT bouncing first
        // FOUR: Ball CROSSES boundary (>= 65m) AFTER bouncing
        // 
        // For balls that don't reach boundary:
        // Distance-based running:
        runThresholds: {
            dot: 8,                 // 0-8m = 0 runs (stopped by fielder)
            single: 22,             // 8-22m = 1 run
            two: 40,                // 22-40m = 2 runs
            three: 55,              // 40-55m = 3 runs
            // 55-65m with bounce = 4 runs
            // 65m+ or 55m+ without bounce = 6 runs
        },

        // Minimum distance for boundary decisions
        nearBoundary: 61            // Near enough that bounce matters
    },

    // ===========================================
    // CRICKET SHOTS - Shot definitions
    // ===========================================
    shots: {
        // Defensive
        'forward-defensive': {
            name: 'Forward Defensive',
            clockPosition: 12,
            direction: { x: 0, y: 0.08, z: 0.25 },
            power: 0.12,
            launchAngle: 5,
            isDefensive: true,
            description: 'Dead bat - kills the ball'
        },

        // Straight shots (mostly along ground)
        'straight-drive': {
            name: 'Straight Drive',
            clockPosition: 12,
            direction: { x: 0, y: 0.25, z: 1.5 },
            power: 0.85,
            launchAngle: 10,  // REDUCED: Ground shot
            description: 'Classic drive along the ground'
        },
        'lofted-straight': {
            name: 'Lofted Straight',
            clockPosition: 12,
            direction: { x: 0, y: 0.8, z: 1.2 },
            power: 0.92,
            launchAngle: 38,
            description: 'Over the bowler\'s head'
        },

        // Off-side shots
        'cover-drive': {
            name: 'Cover Drive',
            clockPosition: 1.5,
            direction: { x: 0.9, y: 0.20, z: 1.2 },
            power: 0.80,
            launchAngle: 8,   // REDUCED: Ground shot
            description: 'Elegant along ground through covers'
        },
        'square-cut': {
            name: 'Square Cut',
            clockPosition: 3,
            direction: { x: 1.6, y: 0.15, z: 0.25 },
            power: 0.75,
            launchAngle: 12,  // REDUCED: Ground shot
            description: 'Horizontal slash along ground'
        },
        'late-cut': {
            name: 'Late Cut',
            clockPosition: 4.5,
            direction: { x: 1.1, y: 0.18, z: -0.5 },
            power: 0.50,
            launchAngle: 15,
            description: 'Delicate past the keeper'
        },

        // Leg-side shots
        'on-drive': {
            name: 'On Drive',
            clockPosition: 10.5,
            direction: { x: -0.6, y: 0.20, z: 1.3 },
            power: 0.80,
            launchAngle: 10,  // REDUCED: Ground shot
            description: 'Along ground through mid-on'
        },
        'flick': {
            name: 'Flick',
            clockPosition: 9,
            direction: { x: -1.1, y: 0.25, z: 0.85 },
            power: 0.70,
            launchAngle: 15,  // REDUCED: Low trajectory
            description: 'Wristy flick along ground'
        },
        'pull-shot': {
            name: 'Pull Shot',
            clockPosition: 8.5,
            direction: { x: -1.5, y: 0.42, z: 0.35 },
            power: 0.95,
            launchAngle: 30,
            description: 'Punishing short ball'
        },
        'hook': {
            name: 'Hook Shot',
            clockPosition: 8,
            direction: { x: -1.7, y: 0.65, z: 0.18 },
            power: 0.88,
            launchAngle: 42,
            description: 'High over square leg'
        },
        'sweep': {
            name: 'Sweep',
            clockPosition: 7.5,
            direction: { x: -1.4, y: 0.18, z: 0.4 },
            power: 0.68,
            launchAngle: 12,
            description: 'Low sweep to fine leg'
        },

        // Miss
        'miss': {
            name: 'Miss!',
            clockPosition: 0,
            direction: { x: 0, y: 0, z: 0 },
            power: 0,
            launchAngle: 0,
            description: 'Missed completely'
        }
    },

    // ===========================================
    // BOWLING SETTINGS
    // ===========================================
    bowling: {
        speeds: {
            slow: { ms: 22, kmh: 80 },
            medium: { ms: 30, kmh: 108 },
            fast: { ms: 38, kmh: 137 },
            express: { ms: 44, kmh: 158 }
        },
        lines: {
            'outside-off': -0.9,
            'off': -0.45,
            'middle': 0,
            'leg': 0.45,
            'outside-leg': 0.9
        },
        lengths: {
            'short': 0.15,
            'short-of-good': 0.35,
            'good': 0.55,
            'full': 0.75,
            'yorker': 0.95
        }
    },

    // ===========================================
    // HAND TRACKING
    // ===========================================
    handTracking: {
        swingThreshold: 1.2,    // Minimum speed for swing detection
        frameSkip: 1,           // Process every N frames

        // Shot direction from hand movement
        directionThresholds: {
            offside: 0.5,
            onside: -0.5,
            lofted: -0.7,
            grounded: 0.25
        }
    },

    // ===========================================
    // HITTING ZONE (where ball can be hit)
    // ===========================================
    hittingZone: {
        minZ: 5,            // Front of zone
        maxZ: 13,           // Back of zone
        minY: 0,            // Ground level
        maxY: 4.5,          // Maximum height
        batZ: 8             // Bat default Z position
    }
};

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Get shot definition by name
 */
export function getShot(name) {
    return GAME_CONFIG.shots[name] || GAME_CONFIG.shots['miss'];
}

/**
 * Calculate runs from distance and bounce status
 * 
 * CORRECT RULES:
 * - FOUR: Ball bounces at least once AND crosses 65m boundary
 * - SIX: Ball crosses 65m boundary WITHOUT bouncing
 * - Otherwise: Distance-based running (0, 1, 2, 3 runs)
 */
export function calculateRuns(distance, hasBounced, shotName = '') {
    const { scoring } = GAME_CONFIG;

    // Defensive shots never score boundaries
    if (shotName === 'Forward Defensive' || shotName === 'Miss!') {
        return 0;
    }

    // === BOUNDARY (65m+) ===
    // FOUR: bounced first, then crossed 65m
    // SIX: clean over 65m without bounce
    const boundaryDistance = GAME_CONFIG.field.boundaryRope;
    if (distance >= boundaryDistance) {
        if (hasBounced) {
            console.log(`📊 FOUR! ${distance.toFixed(1)}m (bounced to boundary)`);
            return 4;
        } else {
            console.log(`📊 SIX! ${distance.toFixed(1)}m (over the rope)`);
            return 6;
        }
    }

    // === RUNNING SCORES (under 65m) ===
    const { runThresholds } = scoring;
    if (distance < runThresholds.dot) return 0;      // 0-8m
    if (distance < runThresholds.single) return 1;   // 8-22m
    if (distance < runThresholds.two) return 2;      // 22-40m
    if (distance < runThresholds.three) return 3;    // 40-55m

    // 55-64m = 3 runs (close but didn't reach 65m)
    return 3;
}

/**
 * Get timing quality and multiplier based on Z-distance from optimal contact
 */
export function getTimingQuality(distanceFromOptimal) {
    const { collision } = GAME_CONFIG;

    if (distanceFromOptimal <= collision.perfectZone) {
        return { quality: 'PERFECT', multiplier: collision.timingMultipliers.perfect };
    }
    if (distanceFromOptimal <= collision.goodZone) {
        return { quality: 'Good', multiplier: collision.timingMultipliers.good };
    }
    if (distanceFromOptimal <= collision.okayZone) {
        return { quality: 'Okay', multiplier: collision.timingMultipliers.okay };
    }
    return { quality: 'Poor', multiplier: collision.timingMultipliers.poor };
}

/**
 * Get speed factor from bat swing speed
 */
export function getSpeedFactor(batSpeed) {
    const { batSpeedCategories } = GAME_CONFIG.collision;

    if (batSpeed >= batSpeedCategories.maximum.max) return batSpeedCategories.maximum.factor;
    if (batSpeed >= batSpeedCategories.power.max) return batSpeedCategories.power.factor;
    if (batSpeed >= batSpeedCategories.attacking.max) return batSpeedCategories.attacking.factor;
    if (batSpeed >= batSpeedCategories.placement.max) return batSpeedCategories.placement.factor;
    return batSpeedCategories.block.factor;
}

/**
 * Get launch angle modifier based on bat zone
 * Returns angle adjustment in degrees
 */
export function getZoneAngleModifier(zoneName) {
    const zone = GAME_CONFIG.batZones[zoneName];
    return zone?.angleModifier || 0;
}

/**
 * Check if ball crossed boundary
 */
export function checkBoundary(distance) {
    return distance >= GAME_CONFIG.field.boundaryRope;
}
