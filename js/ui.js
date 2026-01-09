/**
 * UI Module - Controls and visual overlays
 */

export class UI {
    constructor() {
        // DOM elements
        this.elements = {};

        // Callbacks
        this.onBowl = null;
        this.onRandom = null;

        // Ball overlay element
        this.ballOverlay = null;
        this.batOverlay = null;
    }

    /**
     * Initialize UI elements
     */
    init() {
        // Cache DOM elements
        this.elements = {
            loadingScreen: document.getElementById('loading-screen'),
            loadingStatus: document.querySelector('.loading-status'),
            gameContainer: document.getElementById('game-container'),

            // Controls
            speedControl: document.getElementById('speed-control'),
            lineControl: document.getElementById('line-control'),
            lengthControl: document.getElementById('length-control'),
            bowlBtn: document.getElementById('bowl-btn'),
            randomBtn: document.getElementById('random-btn'),

            // Score
            runs: document.getElementById('runs'),
            balls: document.getElementById('balls'),
            lastShot: document.getElementById('last-shot'),

            // Status
            handStatus: document.getElementById('hand-status'),
            statusDot: document.querySelector('.status-dot'),
            statusText: document.querySelector('.status-text'),

            // Shot result
            shotResult: document.getElementById('shot-result'),

            // Overlays
            cameraOverlay: document.getElementById('camera-overlay'),
            ballTrajectoryOverlay: document.getElementById('ball-trajectory-overlay')
        };

        // Set up event listeners
        this.setupEventListeners();

        // Create ball overlay element
        this.createBallOverlay();

        console.log('UI initialized');
        return this;
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        this.elements.bowlBtn.addEventListener('click', () => {
            if (this.onBowl) this.onBowl();
        });

        this.elements.randomBtn.addEventListener('click', () => {
            if (this.onRandom) this.onRandom();
        });
    }

    /**
     * Create ball overlay for camera view
     */
    createBallOverlay() {
        this.ballOverlay = document.createElement('div');
        this.ballOverlay.className = 'ball-overlay';
        this.ballOverlay.style.display = 'none';
        this.elements.ballTrajectoryOverlay.appendChild(this.ballOverlay);
    }

    /**
     * Update loading status
     */
    setLoadingStatus(status) {
        if (this.elements.loadingStatus) {
            this.elements.loadingStatus.textContent = status;
        }
    }

    /**
     * Hide loading screen
     */
    hideLoading() {
        if (this.elements.loadingScreen) {
            this.elements.loadingScreen.classList.add('hidden');
        }
    }

    /**
     * Get bowling options from controls
     */
    getBowlingOptions() {
        return {
            speed: this.elements.speedControl.value,
            line: this.elements.lineControl.value,
            length: this.elements.lengthControl.value
        };
    }

    /**
     * Set bowling controls (for random)
     */
    setBowlingControls(options) {
        if (options.speed) this.elements.speedControl.value = options.speed;
        if (options.line) this.elements.lineControl.value = options.line;
        if (options.length) this.elements.lengthControl.value = options.length;
    }

    /**
     * Enable/disable bowl button
     */
    setBowlEnabled(enabled) {
        this.elements.bowlBtn.disabled = !enabled;
    }

    /**
     * Update hand tracking status with optional custom message
     */
    setHandStatus(detected, customMessage = null) {
        this.elements.statusDot.classList.toggle('active', detected);

        if (customMessage) {
            this.elements.statusText.textContent = customMessage;
        } else {
            this.elements.statusText.textContent = detected
                ? 'Hand detected ✋'
                : 'Detecting hands...';
        }
    }

    /**
     * Update score display
     */
    updateScore(runs, balls) {
        this.elements.runs.textContent = runs;
        this.elements.balls.textContent = balls;
    }

    /**
     * Show last shot
     */
    showLastShot(shotName, runs) {
        let display = shotName;
        if (runs > 0) {
            display += ` - ${runs}`;
            if (runs === 4) display += ' FOUR!';
            if (runs === 6) display += ' SIX!';
        }
        this.elements.lastShot.textContent = display;
    }

    /**
     * Show shot result popup
     */
    showShotResult(text) {
        this.elements.shotResult.textContent = text;
        this.elements.shotResult.classList.add('visible');

        setTimeout(() => {
            this.elements.shotResult.classList.remove('visible');
        }, 1500);
    }

    /**
     * Update ball position in camera overlay
     */
    updateBallOverlay(position, cameraWidth, cameraHeight) {
        if (!this.ballOverlay || !position) {
            if (this.ballOverlay) this.ballOverlay.style.display = 'none';
            return;
        }

        // Convert 3D position to 2D screen position
        // Ball comes from z=-10 to z=10, map to screen
        const progress = (position.z + 10) / 20; // 0 to 1

        if (progress < 0 || progress > 1) {
            this.ballOverlay.style.display = 'none';
            return;
        }

        // Calculate screen position
        // X: center + offset based on ball x
        // Y: bottom to middle based on ball y and progress
        const screenX = (0.5 + position.x * 0.1) * cameraWidth;
        const screenY = (0.8 - progress * 0.5 - position.y * 0.05) * cameraHeight;

        // Scale based on distance (bigger as it gets closer)
        const scale = 0.5 + progress * 1.5;

        this.ballOverlay.style.display = 'block';
        this.ballOverlay.style.left = `${screenX}px`;
        this.ballOverlay.style.top = `${screenY}px`;
        this.ballOverlay.style.transform = `translate(-50%, -50%) scale(${scale})`;
    }

    /**
     * Hide ball overlay
     */
    hideBallOverlay() {
        if (this.ballOverlay) {
            this.ballOverlay.style.display = 'none';
        }
    }

    /**
     * Show impact effect
     */
    showImpactEffect(x, y) {
        const effect = document.createElement('div');
        effect.className = 'impact-effect';
        effect.style.left = `${x}px`;
        effect.style.top = `${y}px`;

        this.elements.ballTrajectoryOverlay.appendChild(effect);

        setTimeout(() => {
            effect.remove();
        }, 500);
    }

    /**
     * Draw trajectory line
     */
    drawTrajectoryLine(startX, startY, endX, endY) {
        const line = document.createElement('div');
        line.className = 'trajectory-line';

        const length = Math.sqrt((endX - startX) ** 2 + (endY - startY) ** 2);
        const angle = Math.atan2(endY - startY, endX - startX);

        line.style.width = `${length}px`;
        line.style.left = `${startX}px`;
        line.style.top = `${startY}px`;
        line.style.transform = `rotate(${angle}rad)`;

        this.elements.ballTrajectoryOverlay.appendChild(line);

        setTimeout(() => {
            line.style.opacity = '0';
            setTimeout(() => line.remove(), 300);
        }, 500);
    }

    /**
     * Set callback handlers
     */
    setCallbacks(onBowl, onRandom) {
        this.onBowl = onBowl;
        this.onRandom = onRandom;
    }
}
