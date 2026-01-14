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
        // Initialize Icons
        if (window.lucide) {
            window.lucide.createIcons();
        }

        // Cache DOM elements
        this.elements = {
            loadingScreen: document.getElementById('loading-screen'),
            splashScreen: document.getElementById('splash-screen'),
            loadingStatus: document.querySelector('.loading-status'),
            gameContainer: document.getElementById('game-container'),

            // Main Menu
            mainMenu: document.getElementById('main-menu'),
            startMatchBtn: document.getElementById('start-match-btn'),
            playerNameInput: document.getElementById('player-name-input'),
            teamAbbrInput: document.getElementById('team-abbr-input'),
            tvTeamName: document.getElementById('tv-team-name'),

            // Controls
            speedControl: document.getElementById('speed-control'),
            lineControl: document.getElementById('line-control'),
            lengthControl: document.getElementById('length-control'),
            autoBowl: document.getElementById('auto-bowl'),
            bowlBtn: document.getElementById('bowl-btn'),
            randomBtn: document.getElementById('hud-random-btn'), // Updated ID

            // Score (HUD)
            runs: document.getElementById('hud-runs'),
            wickets: document.getElementById('hud-wickets'),
            overs: document.getElementById('hud-overs'),

            // HUD specific
            gameHud: document.getElementById('game-hud'),
            hudToggleBtn: document.getElementById('hud-toggle-btn'),
            hudVisualBtn: document.getElementById('hud-visual-btn'),
            visualPopover: document.getElementById('visual-settings-popover'),
            hudHomeBtn: document.getElementById('hud-home-btn'),

            // New Elements
            resumeBtn: document.getElementById('resume-match-btn'),
            showCard: document.getElementById('show-card'),
            tvScoreboard: document.getElementById('tv-scoreboard'), // Ensure mapped for drag/toggle

            // Status
            handStatus: document.getElementById('hand-status'),
            statusDot: document.querySelector('.status-dot'),
            statusText: document.querySelector('.status-text'),

            // Shot result
            shotResult: document.getElementById('shot-result'),
            // Next Ball Warning
            nextBallWarning: document.getElementById('next-ball-warning'),

            // TV Scoreboard
            tvRuns: document.getElementById('tv-runs'),
            tvWickets: document.getElementById('tv-wickets'),
            tvOvers: document.getElementById('tv-overs'),
            tvCRR: document.getElementById('tv-crr'),
            tvTimeline: document.getElementById('tv-timeline'),

            // Overlays
            cameraOverlay: document.getElementById('camera-overlay'),
            ballTrajectoryOverlay: document.getElementById('ball-trajectory-overlay'),

            // Game Over
            gameOverScreen: document.getElementById('game-over-screen'),
            finalRuns: document.getElementById('final-runs'),
            finalWickets: document.getElementById('final-wickets'),
            finalOvers: document.getElementById('final-overs'),
            playAgainBtn: document.getElementById('play-again-btn')
        };

        // Callbacks
        this.onRestart = null;
        this.isGameActive = false; // Track game state

        // Set up event listeners
        this.setupEventListeners();

        // Create ball overlay element
        this.createBallOverlay();

        // Setup Layout Control
        this.setupLayoutControl();

        // Setup HUD Controls
        this.setupHudControls();

        // Make TV Scoreboard Draggable
        if (this.elements.tvScoreboard) {
            this.makeDraggable(this.elements.tvScoreboard);
        }

        // Initial State

        // Initial State
        this.showSplash();
        this.hideMenu(); // Ensure menu is hidden initially
        // Ensure HUD is hidden initially (since hideMenu now shows it)
        if (this.elements.gameHud) this.elements.gameHud.classList.add('hidden');

        console.log('UI initialized');
        return this;
    }

    // --- Splash Screen & Menu Flow ---

    showSplash() {
        if (this.elements.splashScreen) {
            this.elements.splashScreen.classList.remove('hidden');
        }
    }

    hideSplash() {
        if (this.elements.splashScreen) {
            this.elements.splashScreen.classList.add('hidden');
        }
    }

    showMainMenu() {
        if (this.elements.mainMenu) {
            this.elements.mainMenu.classList.remove('hidden');
            this.elements.mainMenu.style.visibility = 'visible'; // Force visibility
            this.elements.mainMenu.style.opacity = '1';

            // Show/Hide Resume Button based on state
            if (this.elements.resumeBtn) {
                if (this.isGameActive) {
                    this.elements.resumeBtn.classList.remove('hidden');
                } else {
                    this.elements.resumeBtn.classList.add('hidden');
                }
            }
        }
        // Hide HUD when in Menu
        if (this.elements.gameHud) {
            this.elements.gameHud.classList.add('hidden');
        }
    }

    /**
     * Handle the full startup sequence: Splash -> Wait -> Menu
     */
    handleSplashSequence() {
        // 1. Hide Loading (assets loaded)
        this.hideLoading();

        // 2. Keep Splash for a moment (brand moment)
        setTimeout(() => {
            this.hideSplash();
            this.showMainMenu();
        }, 2500); // 2.5s Splash duration
    }

    setupLayoutControl() {
        const buttons = document.querySelectorAll('.layout-btn');
        const container = document.getElementById('game-container');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Remove active class from all
                buttons.forEach(b => b.classList.remove('active'));
                // Add to clicked
                btn.classList.add('active');

                // Get mode
                const mode = btn.dataset.mode;

                // Remove existing layout classes
                container.classList.remove('layout-cam-focus', 'layout-game-focus');

                // Apply new class
                if (mode === 'cam') {
                    container.classList.add('layout-cam-focus'); // Cam 60%
                } else if (mode === 'game') {
                    container.classList.add('layout-game-focus'); // Game 60%
                }

                // Force resize event for Three.js
                for (let i = 1; i <= 10; i++) {
                    setTimeout(() => window.dispatchEvent(new Event('resize')), i * 50);
                }
            });
        });
    }

    /**
     * Set up event listeners
     */
    setupEventListeners() {
        if (this.elements.startMatchBtn) {
            this.elements.startMatchBtn.addEventListener('click', () => {
                this.isGameActive = true;
                if (this.onStartGame) this.onStartGame();
            });
        }

        // Resume Button Logic
        if (this.elements.resumeBtn) {
            this.elements.resumeBtn.addEventListener('click', () => {
                this.hideMenu();
            });
        }

        // Live Team Abbreviation Update
        if (this.elements.teamAbbrInput) {
            this.elements.teamAbbrInput.addEventListener('input', (e) => {
                const val = e.target.value.toUpperCase().slice(0, 4);
                e.target.value = val;
                if (this.elements.tvTeamName) {
                    this.elements.tvTeamName.textContent = val || 'PLR';
                }
            });
        }

        // Bowl Button (Only exists in HUD usually, but kept generally)
        if (this.elements.bowlBtn) {
            this.elements.bowlBtn.addEventListener('click', () => {
                if (this.onBowl) this.onBowl();
            });
        }

        if (this.elements.randomBtn) {
            this.elements.randomBtn.addEventListener('click', () => {
                if (this.onRandom) this.onRandom();
            });
        }

        // --- Synced Controls (HUD <-> Menu) ---

        // Helper to bind dual controls
        const bindSync = (hudId, menuId, type, callback) => {
            const h = document.getElementById(hudId);
            const m = document.getElementById(menuId);
            const handler = (e) => {
                const val = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
                // Sync to other
                if (e.target === h && m) { m.type === 'checkbox' ? m.checked = val : m.value = val; }
                if (e.target === m && h) { h.type === 'checkbox' ? h.checked = val : h.value = val; }
                // Logic
                if (callback) callback(e);
            };
            if (h) h.addEventListener(type, handler);
            if (m) m.addEventListener(type, handler);
        };

        // Speed, Line, Length (No logic needed, just read on bowl)
        bindSync('speed-control', 'speed-control-menu', 'change', null);
        bindSync('line-control', 'line-control-menu', 'change', null);
        bindSync('length-control', 'length-control-menu', 'change', null);

        // Auto Bowl
        bindSync('auto-bowl', 'auto-bowl-menu', 'change', () => {
            // Logic handled by isAutoBowlEnabled checking the HUD element
        });

        // Swing Enabled
        bindSync('swing-enabled', 'swing-enabled-menu', 'change', (e) => {
            const enabled = e.target.checked;
            // Update UI visibility in both places
            const hudG = document.getElementById('swing-controls');
            // Menu might not have a separate div, inputs are always visible or logic hidden
            if (hudG) hudG.style.display = enabled ? 'block' : 'none';
        });

        // Swing Type
        bindSync('swing-type', 'swing-type-menu', 'change', null);

        // Visual Guides
        bindSync('show-shadow', 'show-shadow-menu', 'change', null);
        bindSync('show-zone', 'show-zone-menu', 'change', null);
        bindSync('show-grip', 'show-grip-menu', 'change', null);
        bindSync('show-trail', 'show-trail-menu', 'change', null);


        if (this.elements.playAgainBtn) {
            this.elements.playAgainBtn.addEventListener('click', () => {
                this.hideGameOver();
                if (this.onRestart) this.onRestart();
            });
        }
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

    hideMenu() {
        if (this.elements.mainMenu) {
            this.elements.mainMenu.classList.add('hidden');
            this.elements.mainMenu.style.visibility = '';
            this.elements.mainMenu.style.opacity = '';
        }
        // Show HUD when starting game
        if (this.elements.gameHud) {
            this.elements.gameHud.classList.remove('hidden');
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
        console.log('UI: setBowlEnabled', enabled); // Debugging
        this.elements.bowlBtn.disabled = !enabled;
    }

    /**
     * Check if auto-bowl is enabled
     */
    isAutoBowlEnabled() {
        return this.elements.autoBowl && this.elements.autoBowl.checked;
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
     * Update Scoreboard (TV Style)
     */
    updateScore(runs, balls, wickets, history = [], crr = 0.0) {
        // Update HUD (Center)
        if (this.elements.runs) this.elements.runs.textContent = runs;
        if (this.elements.wickets) this.elements.wickets.textContent = wickets;

        // Format Overs (e.g., 3.2)
        const overs = Math.floor(balls / 6) + '.' + (balls % 6);
        if (this.elements.overs) this.elements.overs.textContent = overs;

        // Optionally update TV scoreboard if needed (sync)
        if (this.elements.tvRuns) this.elements.tvRuns.textContent = runs;
        if (this.elements.tvWickets) this.elements.tvWickets.textContent = wickets;
        if (this.elements.tvOvers) this.elements.tvOvers.textContent = overs;
        if (this.elements.tvCRR) this.elements.tvCRR.textContent = crr.toFixed(1);

        // Update Timeline (Show only CURRENT over balls)
        if (this.elements.tvTimeline) {
            this.elements.tvTimeline.innerHTML = ''; // Clear current

            // Calculate how many balls in current over
            // If remainder is 0, we just finished an over, so show full 6 balls
            // If remainder is 1, we are at ball 1 of new over, so show 1 ball
            const remainder = balls % 6;
            const ballsOnScreen = remainder === 0 ? 6 : remainder;

            // Safe slice from end of history
            const recentBalls = history.slice(-ballsOnScreen);

            recentBalls.forEach(ball => {
                const span = document.createElement('span');
                span.className = 'ball-result';

                // Determine class based on result
                if (ball === 4) span.classList.add('four');
                else if (ball === 6) span.classList.add('six');
                else if (ball === 'W') span.classList.add('wicket');
                else if (ball === 0) {
                    span.classList.add('dot');
                    ball = '•'; // Use bullet for dot ball
                }

                span.textContent = ball;
                this.elements.tvTimeline.appendChild(span);
            });
        }
    }

    /**
     * Update Wickets (Deprecated - handled in updateScore now, but kept for compatibility)
     */
    updateWickets(wickets) {
        // No-op or update if separate call needed
    }

    /**
     * Update swing speed display
     */
    updateSwingSpeed(speed) {
        if (this.elements.swingSpeed) {
            this.elements.swingSpeed.textContent = speed.toFixed(1);
        }
    }

    /**
     * Update distance display during flight
     */
    updateDistance(distance) {
        // Optional: Update a distance display if you have one
        // For now, we can just log it or update a debug element
        // console.log('Distance:', distance.toFixed(1));
    }

    /**
     * Show last shot
     */
    showLastShot(text) {
        if (!this.elements.lastShot) return;
        const display = text || '-';
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
     * Show Get Ready warning
     */
    showGetReady() {
        if (!this.elements.nextBallWarning) return;

        this.isGetReady = true; // Flag for canvas drawing
        this.elements.nextBallWarning.textContent = "NEXT DELIVERY";
        this.elements.nextBallWarning.classList.add('visible');

        setTimeout(() => {
            this.elements.nextBallWarning.classList.remove('visible');
            this.isGetReady = false;
        }, 1500);
    }

    /**
     * Show Dismissal Effect (Red Glow)
     */
    showDismissalEffect() {
        this.isDismissed = true;

        // Reset after 3 seconds (matching physics reset)
        setTimeout(() => {
            this.isDismissed = false;
        }, 3000);
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
    setCallbacks(onBowl, onRandom, onRestart) {
        this.onBowl = onBowl;
        this.onRandom = onRandom;
        this.onRestart = onRestart;
    }

    /**
     * Show Game Over Screen
     */
    showGameOver(runs, wickets, balls) {
        if (!this.elements.gameOverScreen) return;

        this.elements.finalRuns.textContent = runs;
        this.elements.finalWickets.textContent = wickets;

        const overs = Math.floor(balls / 6) + '.' + (balls % 6);
        this.elements.finalOvers.textContent = overs;

        this.elements.gameOverScreen.classList.add('visible');
    }

    /**
     * Hide Game Over Screen
     */
    hideGameOver() {
        if (this.elements.gameOverScreen) {
            this.elements.gameOverScreen.classList.remove('visible');
        }
    }

    /**
     * Setup New HUD Interactions
     */
    setupHudControls() {
        // Toggle HUD Minimize/Maximize
        if (this.elements.hudToggleBtn && this.elements.gameHud) {
            this.elements.hudToggleBtn.addEventListener('click', () => {
                const hud = this.elements.gameHud;
                hud.classList.toggle('minimized');

                // Rotate chevron logic could go here
                const icon = this.elements.hudToggleBtn.querySelector('i');
                if (icon) {
                    // Simple check if class is present to flip icon direction (optional visual polish)
                    // If minimized, chevron-up. If not, chevron-down.
                    // Handled by lucide data update? Simpler is transform in CSS.
                    this.elements.hudToggleBtn.style.transform = hud.classList.contains('minimized')
                        ? 'translate(-50%, -10px) rotate(180deg)'
                        : 'translate(-50%) rotate(0deg)';
                }
            });
        }

        // Toggle Visual Settings Popover
        if (this.elements.hudVisualBtn && this.elements.visualPopover) {
            this.elements.hudVisualBtn.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent closing immediately
                this.elements.visualPopover.classList.toggle('visible');
                this.elements.hudVisualBtn.classList.toggle('active');
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!this.elements.visualPopover.contains(e.target) && e.target !== this.elements.hudVisualBtn) {
                    this.elements.visualPopover.classList.remove('visible');
                    this.elements.hudVisualBtn.classList.remove('active');
                }
            });
        }

        // Home Button (Exit to Menu)
        if (this.elements.hudHomeBtn) {
            this.elements.hudHomeBtn.addEventListener('click', () => {
                // Return to Menu (Resume available)
                this.showMainMenu();
                // Removed showSplash() to prevent infinite loading
            });
        }

        // Show Card Toggle
        if (this.elements.showCard && this.elements.tvScoreboard) {
            this.elements.showCard.addEventListener('change', (e) => {
                this.elements.tvScoreboard.style.display = e.target.checked ? 'block' : 'none';
            });
        }

        // Make TV Scoreboard Draggable
        if (this.elements.tvScoreboard) {
            this.makeDraggable(this.elements.tvScoreboard);
        }
    }

    /**
     * Make an element draggable
     */
    makeDraggable(element) {
        let isDragging = false;
        let currentX;
        let currentY;
        let initialX;
        let initialY;
        let xOffset = 0;
        let yOffset = 0;

        const dragStart = (e) => {
            if (e.target.closest('button') || e.target.closest('input')) return; // Ignore controls

            if (e.type === "touchstart") {
                initialX = e.touches[0].clientX - xOffset;
                initialY = e.touches[0].clientY - yOffset;
            } else {
                initialX = e.clientX - xOffset;
                initialY = e.clientY - yOffset;
            }
            if (element.contains(e.target)) {
                isDragging = true;
            }
        };

        const dragEnd = (e) => {
            initialX = currentX;
            initialY = currentY;
            isDragging = false;
        };

        const drag = (e) => {
            if (isDragging) {
                e.preventDefault();
                if (e.type === "touchmove") {
                    currentX = e.touches[0].clientX - initialX;
                    currentY = e.touches[0].clientY - initialY;
                } else {
                    currentX = e.clientX - initialX;
                    currentY = e.clientY - initialY;
                }
                xOffset = currentX;
                yOffset = currentY;
                element.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
            }
        };

        element.addEventListener("mousedown", dragStart);
        document.addEventListener("mouseup", dragEnd);
        document.addEventListener("mousemove", drag);

        element.addEventListener("touchstart", dragStart, { passive: false });
        document.addEventListener("touchend", dragEnd);
        document.addEventListener("touchmove", drag, { passive: false });

        element.style.cursor = 'move';
    }
}
