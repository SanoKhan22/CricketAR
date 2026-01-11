/**
 * Timing System - Calculates timing quality for bat-ball contact
 * 
 * Perfect timing = ball at optimal Z position during peak bat speed
 * Returns quality rating and power multiplier
 */

export class TimingSystem {
    constructor() {
        // Optimal contact zone (Z position where perfect timing occurs)
        this.sweetSpotZ = 9.5;           // Slightly in front of crease (Z=10)
        this.sweetSpotTolerance = 0.3;   // ± tolerance for perfect
        this.goodTolerance = 0.6;        // ± tolerance for good
        this.acceptableTolerance = 1.0;  // ± tolerance for acceptable

        // Track downswing timing
        this.downswingStartTime = null;
        this.peakBatSpeedTime = null;
        this.contactTime = null;

        // Optimal timing windows (ms from downswing start)
        this.optimalContactWindowStart = 80;   // Earliest good contact
        this.optimalContactWindowEnd = 180;    // Latest good contact
        this.peakPowerTime = 120;              // When bat speed is maximum

        // Quality ratings
        this.qualities = {
            PERFECT: { label: 'Perfect!', multiplier: 1.2, color: '#00ff00' },
            GOOD: { label: 'Good', multiplier: 1.0, color: '#88ff00' },
            EARLY: { label: 'Early', multiplier: 0.7, color: '#ffaa00' },
            LATE: { label: 'Late', multiplier: 0.6, color: '#ff6600' },
            MISHIT: { label: 'Mishit', multiplier: 0.3, color: '#ff0000' }
        };

        // Last timing result for display
        this.lastResult = null;
    }

    /**
     * Called when downswing starts
     */
    onDownswingStart() {
        this.downswingStartTime = Date.now();
        this.peakBatSpeedTime = null;
        this.contactTime = null;
    }

    /**
     * Called when peak bat speed is detected
     */
    onPeakBatSpeed() {
        this.peakBatSpeedTime = Date.now();
    }

    /**
     * Calculate timing quality at moment of contact
     * @param {number} ballZ - Ball's Z position at contact
     * @param {number} batSpeed - Bat speed at contact
     * @returns {Object} Timing result with quality, multiplier, and feedback
     */
    calculateTiming(ballZ, batSpeed = 1.0) {
        const now = Date.now();
        this.contactTime = now;

        // Distance from ideal contact point
        const distanceFromIdeal = Math.abs(ballZ - this.sweetSpotZ);

        // Time since downswing started
        const timeSinceDownswing = this.downswingStartTime
            ? now - this.downswingStartTime
            : 150; // Default if not tracked

        // Calculate spatial timing quality
        let spatialQuality;
        if (distanceFromIdeal <= this.sweetSpotTolerance) {
            spatialQuality = 'PERFECT';
        } else if (distanceFromIdeal <= this.goodTolerance) {
            spatialQuality = 'GOOD';
        } else if (distanceFromIdeal <= this.acceptableTolerance) {
            // Determine if early or late based on ball position
            spatialQuality = ballZ > this.sweetSpotZ ? 'EARLY' : 'LATE';
        } else {
            spatialQuality = 'MISHIT';
        }

        // Calculate temporal timing quality
        let temporalQuality;
        if (timeSinceDownswing >= this.optimalContactWindowStart &&
            timeSinceDownswing <= this.optimalContactWindowEnd) {
            // Within optimal window
            const windowMid = (this.optimalContactWindowStart + this.optimalContactWindowEnd) / 2;
            const deviation = Math.abs(timeSinceDownswing - windowMid);
            if (deviation < 30) {
                temporalQuality = 'PERFECT';
            } else {
                temporalQuality = 'GOOD';
            }
        } else if (timeSinceDownswing < this.optimalContactWindowStart) {
            temporalQuality = 'EARLY';
        } else {
            temporalQuality = 'LATE';
        }

        // Combine spatial and temporal quality
        const finalQuality = this.combineQualities(spatialQuality, temporalQuality);
        const qualityData = this.qualities[finalQuality];

        // Apply bat speed bonus
        const speedBonus = Math.min(1.3, 0.8 + batSpeed * 0.05);
        const finalMultiplier = qualityData.multiplier * speedBonus;

        this.lastResult = {
            quality: finalQuality,
            label: qualityData.label,
            multiplier: finalMultiplier,
            color: qualityData.color,
            spatialQuality,
            temporalQuality,
            distanceFromIdeal,
            timeSinceDownswing,
            batSpeed
        };

        console.log(`⏱️ Timing: ${qualityData.label} (${finalMultiplier.toFixed(2)}x) - ` +
            `Spatial: ${spatialQuality}, Temporal: ${temporalQuality}`);

        return this.lastResult;
    }

    /**
     * Combine spatial and temporal quality into final rating
     */
    combineQualities(spatial, temporal) {
        // Both perfect = perfect
        if (spatial === 'PERFECT' && temporal === 'PERFECT') {
            return 'PERFECT';
        }

        // One perfect, one good = good
        if ((spatial === 'PERFECT' && temporal === 'GOOD') ||
            (spatial === 'GOOD' && temporal === 'PERFECT')) {
            return 'GOOD';
        }

        // Both good = good
        if (spatial === 'GOOD' && temporal === 'GOOD') {
            return 'GOOD';
        }

        // One mishit = mishit
        if (spatial === 'MISHIT' || temporal === 'MISHIT') {
            return 'MISHIT';
        }

        // Early/Late combinations
        if (spatial === 'EARLY' || temporal === 'EARLY') {
            return 'EARLY';
        }

        if (spatial === 'LATE' || temporal === 'LATE') {
            return 'LATE';
        }

        return 'GOOD'; // Default
    }

    /**
     * Get visual feedback text for timing
     */
    getFeedbackText() {
        if (!this.lastResult) return '';

        const r = this.lastResult;

        switch (r.quality) {
            case 'PERFECT':
                return '🎯 PERFECT TIMING!';
            case 'GOOD':
                return '✓ Good timing';
            case 'EARLY':
                return '⚡ Early! Wait for it';
            case 'LATE':
                return '⏰ Late! Speed up';
            case 'MISHIT':
                return '❌ Mishit';
            default:
                return '';
        }
    }

    /**
     * Reset for new delivery
     */
    reset() {
        this.downswingStartTime = null;
        this.peakBatSpeedTime = null;
        this.contactTime = null;
        this.lastResult = null;
    }

    /**
     * Get timing stats for display
     */
    getStats() {
        return {
            lastResult: this.lastResult,
            hasActiveSwing: this.downswingStartTime !== null,
            timeSinceDownswing: this.downswingStartTime
                ? Date.now() - this.downswingStartTime
                : null
        };
    }
}
