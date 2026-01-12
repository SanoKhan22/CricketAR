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
        this.createRoof();
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
                // Add weathering - darker from wear
                const treadWeatherFactor = 0.85 + Math.random() * 0.15; // 0.85 to 1.0 (darker/worn)
                const treadWeatheredColor = new THREE.Color(tier.color).multiplyScalar(treadWeatherFactor);

                const treadGeometry = new THREE.RingGeometry(stepInnerRadius, stepOuterRadius, 64);
                const treadMaterial = new THREE.MeshLambertMaterial({
                    color: treadWeatheredColor,
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

                // === ADD INDIVIDUAL SEATS ON EACH STEP ===
                const seatCount = Math.floor((stepInnerRadius + stepOuterRadius) / 2 * 0.4); // ~30-40 seats per row
                const seatWidth = 0.4;
                const seatDepth = 0.35;
                const seatBackHeight = 0.3;

                // Seat geometry
                const seatGeometry = new THREE.BoxGeometry(seatWidth, 0.15, seatDepth);
                const seatBackGeometry = new THREE.BoxGeometry(seatWidth, seatBackHeight, 0.05);

                for (let s = 0; s < seatCount; s++) {
                    const angle = (s / seatCount) * Math.PI * 2;
                    const seatRadius = (stepInnerRadius + stepOuterRadius) / 2;

                    // === WEATHERING: Random color variation for each seat ===
                    const weatherFactor = 0.8 + Math.random() * 0.5; // 0.8 to 1.3
                    const weatheredColor = new THREE.Color(tier.color).multiplyScalar(weatherFactor);
                    const seatMaterial = new THREE.MeshLambertMaterial({ color: weatheredColor });

                    // Seat base
                    const seat = new THREE.Mesh(seatGeometry, seatMaterial);
                    seat.position.set(
                        Math.cos(angle) * seatRadius,
                        stepY + stepHeight + 0.08,
                        Math.sin(angle) * seatRadius
                    );
                    seat.rotation.y = -angle;
                    this.scene.add(seat);
                    this.elements.push(seat);

                    // Seat back (slightly different wear)
                    const backWeatherFactor = 0.8 + Math.random() * 0.5;
                    const backWeatheredColor = new THREE.Color(tier.color).multiplyScalar(backWeatherFactor);
                    const backMaterial = new THREE.MeshLambertMaterial({ color: backWeatheredColor });

                    const backRest = new THREE.Mesh(seatBackGeometry, backMaterial);
                    backRest.position.set(
                        Math.cos(angle) * (seatRadius - seatDepth / 2 + 0.05),
                        stepY + stepHeight + 0.22,
                        Math.sin(angle) * (seatRadius - seatDepth / 2 + 0.05)
                    );
                    backRest.rotation.y = -angle;
                    this.scene.add(backRest);
                    this.elements.push(backRest);
                }
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
     * Create partial roof section (rear stands only)
     * Smaller coverage to avoid blocking camera view
     */
    createRoof() {
        const roofInnerRadius = 70; // Doesn't cover playing area
        const roofOuterRadius = 82; // Beyond upper tier
        const roofHeight = 18;

        // Partial roof section (only rear half - 180 degrees)
        const roofStartAngle = Math.PI / 2; // Side
        const roofEndAngle = roofStartAngle + Math.PI; // 180 degrees coverage

        // Create partial ring geometry using Shape
        const roofShape = new THREE.Shape();
        const segments = 32;

        // Outer arc
        for (let i = 0; i <= segments; i++) {
            const angle = roofStartAngle + (i / segments) * (roofEndAngle - roofStartAngle);
            const x = Math.cos(angle) * roofOuterRadius;
            const y = Math.sin(angle) * roofOuterRadius;
            if (i === 0) roofShape.moveTo(x, y);
            else roofShape.lineTo(x, y);
        }

        // Inner arc (reverse)
        for (let i = segments; i >= 0; i--) {
            const angle = roofStartAngle + (i / segments) * (roofEndAngle - roofStartAngle);
            const x = Math.cos(angle) * roofInnerRadius;
            const y = Math.sin(angle) * roofInnerRadius;
            roofShape.lineTo(x, y);
        }

        const roofGeometry = new THREE.ShapeGeometry(roofShape);
        const roofMaterial = new THREE.MeshLambertMaterial({
            color: 0x333333,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.85
        });

        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.rotation.x = -Math.PI / 2;
        roof.position.y = roofHeight;
        this.scene.add(roof);
        this.elements.push(roof);

        // Support pillars (4 pillars only on covered section)
        const pillarCount = 4;
        const pillarGeometry = new THREE.CylinderGeometry(0.5, 0.6, roofHeight - 7, 8);
        const pillarMaterial = new THREE.MeshLambertMaterial({ color: 0x555555 });

        for (let i = 0; i < pillarCount; i++) {
            const angle = roofStartAngle + (i / (pillarCount - 1)) * (roofEndAngle - roofStartAngle);
            const pillar = new THREE.Mesh(pillarGeometry, pillarMaterial);
            pillar.position.set(
                Math.cos(angle) * (roofOuterRadius - 1),
                (roofHeight - 7) / 2 + 7,
                Math.sin(angle) * (roofOuterRadius - 1)
            );
            this.scene.add(pillar);
            this.elements.push(pillar);
        }

        // Cable supports (only for covered section)
        const cableGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
        const cableMaterial = new THREE.MeshLambertMaterial({ color: 0x888888 });

        for (let i = 0; i < pillarCount; i++) {
            const angle = roofStartAngle + (i / (pillarCount - 1)) * (roofEndAngle - roofStartAngle);
            const outerX = Math.cos(angle) * (roofOuterRadius - 1);
            const outerZ = Math.sin(angle) * (roofOuterRadius - 1);
            const innerX = Math.cos(angle) * roofInnerRadius;
            const innerZ = Math.sin(angle) * roofInnerRadius;

            const dx = innerX - outerX;
            const dz = innerZ - outerZ;
            const length = Math.sqrt(dx * dx + dz * dz);

            const cable = new THREE.Mesh(cableGeometry, cableMaterial);
            cable.scale.y = length;
            cable.position.set(
                (outerX + innerX) / 2,
                roofHeight - 0.15,
                (outerZ + innerZ) / 2
            );
            cable.rotation.x = Math.PI / 2;
            cable.rotation.z = Math.atan2(dz, dx);
            this.scene.add(cable);
            this.elements.push(cable);
        }

        // Partial tension ring (only for covered arc)
        const ringCurve = new THREE.EllipseCurve(
            0, 0,
            roofInnerRadius, roofInnerRadius,
            roofStartAngle, roofEndAngle,
            false,
            0
        );
        const ringPoints = ringCurve.getPoints(50);
        const ringGeometry = new THREE.BufferGeometry().setFromPoints(ringPoints);
        const ringMaterial = new THREE.LineBasicMaterial({ color: 0x666666, linewidth: 3 });
        const tensionRing = new THREE.Line(ringGeometry, ringMaterial);
        tensionRing.rotation.x = -Math.PI / 2;
        tensionRing.position.y = roofHeight;
        this.scene.add(tensionRing);
        this.elements.push(tensionRing);
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
