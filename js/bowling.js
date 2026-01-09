/**
 * Bowling Module - Bowling mechanics and delivery types
 */

export class Bowling {
    constructor() {
        // Bowling parameters
        this.speed = 'medium';
        this.line = 'middle';
        this.length = 'good';

        // Speed mappings (km/h to m/s)
        this.speedMap = {
            'slow': 22,      // ~80 km/h
            'medium': 30,    // ~110 km/h
            'fast': 39,      // ~140 km/h
            'express': 44    // ~160 km/h
        };

        // Line mappings (x offset)
        this.lineMap = {
            'outside-off': -0.8,
            'off': -0.4,
            'middle': 0,
            'leg': 0.4,
            'outside-leg': 0.8
        };

        // Length mappings (0 = short, 1 = full)
        this.lengthMap = {
            'short': 0.1,
            'short-of-good': 0.3,
            'good': 0.5,
            'full': 0.7,
            'yorker': 0.95
        };

        // Delivery variations
        this.deliveryTypes = [
            'straight',
            'outswinger',
            'inswinger',
            'bouncer',
            'yorker',
            'slower'
        ];
    }

    /**
     * Set bowling speed
     */
    setSpeed(speed) {
        if (this.speedMap[speed] !== undefined) {
            this.speed = speed;
        }
    }

    /**
     * Set bowling line
     */
    setLine(line) {
        if (this.lineMap[line] !== undefined) {
            this.line = line;
        }
    }

    /**
     * Set bowling length
     */
    setLength(length) {
        if (this.lengthMap[length] !== undefined) {
            this.length = length;
        }
    }

    /**
     * Generate bowling parameters
     */
    getDeliveryParams() {
        return {
            speed: this.speedMap[this.speed],
            line: this.lineMap[this.line],
            length: this.lengthMap[this.length],
            spin: 0,
            swing: 0
        };
    }

    /**
     * Generate random delivery
     */
    randomDelivery() {
        const speeds = Object.keys(this.speedMap);
        const lines = Object.keys(this.lineMap);
        const lengths = Object.keys(this.lengthMap);

        this.speed = speeds[Math.floor(Math.random() * speeds.length)];
        this.line = lines[Math.floor(Math.random() * lines.length)];
        this.length = lengths[Math.floor(Math.random() * lengths.length)];

        // Add random variation
        const variation = this.getRandomVariation();

        return {
            ...this.getDeliveryParams(),
            ...variation,
            description: this.getDeliveryDescription()
        };
    }

    /**
     * Get random swing/spin variation
     */
    getRandomVariation() {
        const rand = Math.random();

        if (rand < 0.2) {
            // Outswinger
            return { swing: 0.3, spin: 0 };
        } else if (rand < 0.4) {
            // Inswinger
            return { swing: -0.3, spin: 0 };
        } else if (rand < 0.5) {
            // Off-spin
            return { swing: 0, spin: 0.5 };
        } else if (rand < 0.6) {
            // Leg-spin
            return { swing: 0, spin: -0.5 };
        }

        return { swing: 0, spin: 0 };
    }

    /**
     * Get delivery description
     */
    getDeliveryDescription() {
        return `${this.speed} ${this.length} on ${this.line}`;
    }

    /**
     * Calculate ball time to reach batsman
     */
    getTimeToReach(speed) {
        // Distance is about 20 meters (22 yards)
        const distance = 20;
        const speedMs = speed || this.speedMap[this.speed];
        return distance / speedMs;
    }

    /**
     * Get visual description for UI
     */
    getVisualParams() {
        return {
            speed: this.speed,
            line: this.line,
            length: this.length,
            speedKmh: Math.round(this.speedMap[this.speed] * 3.6),
            description: this.getDeliveryDescription()
        };
    }
}
