/**
 * Stadium Environment Module
 * Creates boundary, seating, sky dome, and other stadium elements
 * Optimized with InstancedMesh and LOD for performance
 */

import * as THREE from 'three';

export class StadiumEnvironment {
    constructor(scene) {
        this.scene = scene;
        this.elements = [];
    }

    /**
     * Create all stadium environment elements
     */
    create() {
        this.createBoundaryRope();
        this.createAdBoards();
        this.createSeating();
        // Sky dome removed - was appearing as blue wall behind seating
        this.createScoreboard();

        console.log('🏟️ Stadium environment created');
    }

    /**
     * Create boundary rope around field edge
     */
    createBoundaryRope() {
        const rope = new THREE.Mesh(
            new THREE.TorusGeometry(66, 0.1, 8, 64),
            new THREE.MeshLambertMaterial({ color: 0xffffff })
        );
        rope.rotation.x = Math.PI / 2;
        rope.position.y = 0.1;
        this.scene.add(rope);
        this.elements.push(rope);
    }

    /**
     * Create advertising boards around boundary (12 boards)
     */
    createAdBoards() {
        const boardGeometry = new THREE.PlaneGeometry(8, 1.5);

        // Cricket sponsor colors - high contrast
        const colors = [
            0xff6600, // Orange
            0x0066ff, // Blue
            0xcc0000, // Red
            0x00cc00, // Green
            0xff3399, // Pink
            0xffcc00, // Yellow
        ];

        // Create 12 boards around the stadium
        const boardCount = 12;
        const radius = 68; // Just outside boundary rope

        for (let i = 0; i < boardCount; i++) {
            const angle = (i / boardCount) * Math.PI * 2;
            const color = colors[i % colors.length];

            const board = new THREE.Mesh(
                boardGeometry,
                new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide })
            );

            // Position around circle
            board.position.x = Math.cos(angle) * radius;
            board.position.z = Math.sin(angle) * radius;
            board.position.y = 0.75;

            // Face inward
            board.rotation.y = -angle + Math.PI / 2;

            this.scene.add(board);
            this.elements.push(board);
        }
    }

    /**
     * Create stadium stairs with visible steps
     * 3 tiers with darker, realistic colors
     */
    createSeating() {
        // Darker, more realistic stadium colors
        const tiers = [
            { color: 0x992222, innerRadius: 70, outerRadius: 73, baseHeight: 0, steps: 6 },      // Lower - Dark Red
            { color: 0x223399, innerRadius: 73, outerRadius: 76.5, baseHeight: 2.2, steps: 7 },  // Middle - Dark Blue
            { color: 0x229922, innerRadius: 76.5, outerRadius: 80, baseHeight: 4.7, steps: 8 }   // Upper - Dark Green
        ];

        tiers.forEach((tier) => {
            const tierDepth = tier.outerRadius - tier.innerRadius;
            const stepDepth = tierDepth / tier.steps;
            const stepHeight = 0.35; // Height of each step

            // Create individual steps for stair effect
            for (let i = 0; i < tier.steps; i++) {
                const stepInnerRadius = tier.innerRadius + (i * stepDepth);
                const stepOuterRadius = stepInnerRadius + stepDepth;
                const stepY = tier.baseHeight + (i * stepHeight);

                // Step tread (horizontal surface to step on)
                const treadGeometry = new THREE.RingGeometry(stepInnerRadius, stepOuterRadius, 64);
                const treadMaterial = new THREE.MeshLambertMaterial({
                    color: tier.color,
                    side: THREE.DoubleSide
                });
                const tread = new THREE.Mesh(treadGeometry, treadMaterial);
                tread.rotation.x = -Math.PI / 2;
                tread.position.y = stepY + stepHeight;
                this.scene.add(tread);
                this.elements.push(tread);

                // Step riser (vertical face at front of step)
                const riserGeometry = new THREE.CylinderGeometry(
                    stepInnerRadius,
                    stepInnerRadius,
                    stepHeight,
                    64,
                    1,
                    true
                );
                const riserMaterial = new THREE.MeshLambertMaterial({
                    color: tier.color,
                    side: THREE.DoubleSide
                });
                const riser = new THREE.Mesh(riserGeometry, riserMaterial);
                riser.position.y = stepY + stepHeight / 2;
                this.scene.add(riser);
                this.elements.push(riser);
            }

            // Outer back wall
            const totalHeight = tier.steps * stepHeight;
            const wallGeometry = new THREE.CylinderGeometry(
                tier.outerRadius,
                tier.outerRadius,
                totalHeight,
                64,
                1,
                true
            );
            const wallMaterial = new THREE.MeshLambertMaterial({
                color: tier.color,
                side: THREE.BackSide,
                transparent: true,
                opacity: 0.8
            });
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.y = tier.baseHeight + totalHeight / 2;
            this.scene.add(wall);
            this.elements.push(wall);
        });
    }

    /**
     * Create sky dome with gradient
     */
    createSkyDome() {
        const skyGeometry = new THREE.SphereGeometry(300, 32, 15, 0, Math.PI * 2, 0, Math.PI / 2);

        // Create gradient material (sky blue to light blue)
        const skyMaterial = new THREE.MeshBasicMaterial({
            color: 0x87CEEB,
            side: THREE.BackSide,
            fog: false
        });

        const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
        skyDome.rotation.x = Math.PI;
        this.scene.add(skyDome);
        this.elements.push(skyDome);
    }

    /**
     * Create scoreboard with dynamic score display
     */
    createScoreboard() {
        // Scoreboard structure
        const poleGeometry = new THREE.CylinderGeometry(0.3, 0.3, 12, 8);
        const poleMaterial = new THREE.MeshLambertMaterial({ color: 0x333333 });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(0, 6, -75);
        this.scene.add(pole);
        this.elements.push(pole);

        // Display board frame
        const boardGeometry = new THREE.PlaneGeometry(10, 6);
        const boardMaterial = new THREE.MeshLambertMaterial({
            color: 0x1a1a1a,
            side: THREE.DoubleSide
        });
        const board = new THREE.Mesh(boardGeometry, boardMaterial);
        board.position.set(0, 15, -75);
        this.scene.add(board);
        this.elements.push(board);

        // Create canvas for score display
        this.scoreCanvas = document.createElement('canvas');
        this.scoreCanvas.width = 512;
        this.scoreCanvas.height = 256;
        this.scoreContext = this.scoreCanvas.getContext('2d');

        // Create texture from canvas
        this.scoreTexture = new THREE.CanvasTexture(this.scoreCanvas);
        this.scoreTexture.minFilter = THREE.LinearFilter;
        this.scoreTexture.magFilter = THREE.LinearFilter;

        // Display panel with canvas texture
        const displayGeometry = new THREE.PlaneGeometry(9, 5);
        const displayMaterial = new THREE.MeshBasicMaterial({
            map: this.scoreTexture,
            side: THREE.FrontSide
        });
        this.scoreDisplay = new THREE.Mesh(displayGeometry, displayMaterial);
        this.scoreDisplay.position.set(0, 15, -74.9);
        this.scene.add(this.scoreDisplay);
        this.elements.push(this.scoreDisplay);

        // Initialize with default score
        this.updateScore(0, 0);
    }

    /**
     * Update scoreboard display
     * @param {number} runs - Current runs
     * @param {number} balls - Balls bowled
     */
    updateScore(runs, balls) {
        if (!this.scoreContext) return;

        const ctx = this.scoreContext;
        const width = this.scoreCanvas.width;
        const height = this.scoreCanvas.height;

        // Clear canvas
        ctx.fillStyle = '#003300';
        ctx.fillRect(0, 0, width, height);

        // Draw score
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 80px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${runs}`, width / 2, height / 2 - 40);

        // Draw balls count
        ctx.font = 'bold 40px Arial';
        ctx.fillText(`Balls: ${balls}`, width / 2, height / 2 + 50);

        // Update texture
        this.scoreTexture.needsUpdate = true;
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.elements.forEach(element => {
            if (element.geometry) element.geometry.dispose();
            if (element.material) element.material.dispose();
            this.scene.remove(element);
        });
        this.elements = [];
    }
}
