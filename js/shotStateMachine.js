/**
 * Shot State Machine - Tracks batting phases
 * 
 * Phases: STANCE → BACKLIFT → DOWNSWING → FOLLOW_THROUGH → RECOVERY
 * Based on real cricket batting: Stance (ready) → Backlift (47°) → Launch (30°)
 */

export class ShotStateMachine {
    constructor() {
        // State definitions
        this.states = {
            IDLE: 'idle',
            STANCE: 'stance',
            BACKLIFT: 'backlift',
            DOWNSWING: 'downswing',
            CONTACT: 'contact',
            FOLLOW_THROUGH: 'follow_through',
            RECOVERY: 'recovery'
        };

        this.currentState = this.states.STANCE;
        this.previousState = null;
        this.stateStartTime = Date.now();

        // Phase timing (milliseconds)
        this.minBackliftDuration = 100;   // Minimum backlift hold time
        this.minDownswingDuration = 50;   // Minimum downswing time
        this.recoveryDuration = 500;       // Time to return to stance

        // Angle thresholds (degrees)
        this.backliftAngleMin = 35;  // Start of backlift
        this.backliftAngleMax = 70;  // Max backlift (around 47° is ideal)
        this.downswingAngleMax = 40; // During downswing
        this.followThroughAngle = 10; // After contact

        // Velocity thresholds (normalized units/frame)
        this.backliftVelocityThreshold = -0.02;  // Upward movement
        this.downswingVelocityThreshold = 0.03;  // Downward/forward movement
        this.swingSpeedThreshold = 0.05;          // Minimum swing speed

        // State history for analysis
        this.stateHistory = [];
        this.maxHistoryLength = 30; // Keep last 30 state changes

        // Callbacks
        this.onStateChange = null;
        this.onDownswingStart = null;
        this.onContactReady = null;
    }

    /**
     * Update state machine based on hand tracking data
     * @param {Object} handData - { angle, velocity, position, isTracking }
     */
    update(handData) {
        if (!handData || !handData.isTracking) {
            this.transitionTo(this.states.IDLE);
            return this.currentState;
        }

        const { angle, velocity, position } = handData;
        const newState = this.detectPhase(angle, velocity, position);

        if (newState !== this.currentState) {
            this.transitionTo(newState);
        }

        return this.currentState;
    }

    /**
     * Detect current batting phase based on hand data
     */
    detectPhase(angle, velocity, position) {
        const timeSinceStateChange = Date.now() - this.stateStartTime;

        switch (this.currentState) {
            case this.states.IDLE:
            case this.states.RECOVERY:
                // Return to stance when hand is stable
                if (Math.abs(velocity.magnitude) < 0.02) {
                    return this.states.STANCE;
                }
                break;

            case this.states.STANCE:
                // Detect backlift (hand moving up and back)
                if (angle > this.backliftAngleMin &&
                    velocity.y < this.backliftVelocityThreshold) {
                    return this.states.BACKLIFT;
                }
                // Direct downswing without backlift (quick shot)
                if (velocity.z < -this.downswingVelocityThreshold &&
                    velocity.magnitude > this.swingSpeedThreshold) {
                    return this.states.DOWNSWING;
                }
                break;

            case this.states.BACKLIFT:
                // Detect downswing start (hand moving forward/down)
                if (velocity.z < -this.downswingVelocityThreshold ||
                    (velocity.y > 0.02 && angle < this.backliftAngleMax)) {
                    return this.states.DOWNSWING;
                }
                // Still in backlift if angle high and moving up
                if (angle > this.backliftAngleMax) {
                    return this.states.BACKLIFT; // Cap at max
                }
                break;

            case this.states.DOWNSWING:
                // Detect follow-through (swing completed)
                if (timeSinceStateChange > this.minDownswingDuration) {
                    if (angle < this.followThroughAngle ||
                        velocity.magnitude < 0.03) {
                        return this.states.FOLLOW_THROUGH;
                    }
                }
                // Ball contact window is during downswing
                if (timeSinceStateChange > 30 && timeSinceStateChange < 200) {
                    // This is the optimal contact window
                    if (this.onContactReady) {
                        this.onContactReady(timeSinceStateChange);
                    }
                }
                break;

            case this.states.FOLLOW_THROUGH:
                // Transition to recovery
                if (timeSinceStateChange > 100) {
                    return this.states.RECOVERY;
                }
                break;
        }

        return this.currentState;
    }

    /**
     * Transition to a new state
     */
    transitionTo(newState) {
        if (newState === this.currentState) return;

        this.previousState = this.currentState;
        this.currentState = newState;
        this.stateStartTime = Date.now();

        // Record history
        this.stateHistory.push({
            from: this.previousState,
            to: newState,
            timestamp: this.stateStartTime
        });

        // Trim history
        if (this.stateHistory.length > this.maxHistoryLength) {
            this.stateHistory.shift();
        }

        // Fire callbacks
        if (this.onStateChange) {
            this.onStateChange(this.previousState, newState);
        }

        if (newState === this.states.DOWNSWING && this.onDownswingStart) {
            this.onDownswingStart(this.stateStartTime);
        }

        console.log(`🏏 Shot Phase: ${this.previousState} → ${newState}`);
    }

    /**
     * Check if currently in a hitting-ready state
     */
    isReadyToHit() {
        return this.currentState === this.states.DOWNSWING;
    }

    /**
     * Check if backlift was performed (affects power)
     */
    hadBacklift() {
        return this.stateHistory.some(h => h.to === this.states.BACKLIFT);
    }

    /**
     * Get backlift quality (0-1)
     */
    getBackliftQuality() {
        const backliftTransition = this.stateHistory.find(
            h => h.to === this.states.BACKLIFT
        );

        if (!backliftTransition) return 0;

        // Find how long backlift was held
        const downswingTransition = this.stateHistory.find(
            h => h.from === this.states.BACKLIFT && h.to === this.states.DOWNSWING
        );

        if (!downswingTransition) return 0.5;

        const backliftDuration = downswingTransition.timestamp - backliftTransition.timestamp;

        // Optimal backlift is ~200-400ms
        if (backliftDuration < 100) return 0.5;  // Too quick
        if (backliftDuration < 200) return 0.7;
        if (backliftDuration < 400) return 1.0;  // Perfect
        if (backliftDuration < 600) return 0.8;
        return 0.6; // Too slow
    }

    /**
     * Reset state machine for new delivery
     */
    reset() {
        this.currentState = this.states.STANCE;
        this.previousState = null;
        this.stateStartTime = Date.now();
        this.stateHistory = [];
    }

    /**
     * Get current state info
     */
    getStateInfo() {
        return {
            current: this.currentState,
            previous: this.previousState,
            duration: Date.now() - this.stateStartTime,
            isReadyToHit: this.isReadyToHit(),
            hadBacklift: this.hadBacklift(),
            backliftQuality: this.getBackliftQuality()
        };
    }
}
