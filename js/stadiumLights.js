/**
 * Stadium Lights Module
 * Creates and manages cricket stadium floodlights with day/night mode
 */

import * as THREE from 'three';

export class StadiumLights {
    constructor(scene) {
        this.scene = scene;
        this.lights = [];
        this.towers = [];
        this.isEnabled = false; // Start with lights off (day mode)
        this.ambientLight = null; // Ambient light for night mode
    }

    /**
     * Create all stadium light towers and spotlights
     */
    create() {
        // 4 towers positioned at corners around the field
        // Cricket stadiums typically have 4-6 light towers
        const towerPositions = [
            { x: -50, y: 0, z: -50 },  // Back-left corner
            { x: 50, y: 0, z: -50 },   // Back-right corner
            { x: 50, y: 0, z: 50 },    // Front-right corner
            { x: -50, y: 0, z: 50 }    // Front-left corner
        ];

        towerPositions.forEach((pos, index) => {
            this.createLightTower(pos, index);
        });

        // Create ambient light for night mode (starts off)
        this.ambientLight = new THREE.AmbientLight(0xffd580, 0); // Warm color, 0 intensity initially
        this.scene.add(this.ambientLight);

        console.log(`✨ Created ${this.towers.length} light towers with ${this.lights.length} spotlights`);
    }

    /**
     * Create a single light tower with multiple spotlights
     */
    createLightTower(position, index) {
        const towerHeight = 50;

        // --- Tower Structure ---
        // Main pole (cylinder)
        const poleGeometry = new THREE.CylinderGeometry(0.5, 0.8, towerHeight, 8);
        const poleMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.6,
            roughness: 0.4
        });
        const pole = new THREE.Mesh(poleGeometry, poleMaterial);
        pole.position.set(position.x, towerHeight / 2, position.z);
        pole.castShadow = true;
        this.scene.add(pole);

        // Platform on top (box)
        const platformGeometry = new THREE.BoxGeometry(4, 1, 4);
        const platformMaterial = new THREE.MeshStandardMaterial({
            color: 0x999999,
            metalness: 0.7,
            roughness: 0.3
        });
        const platform = new THREE.Mesh(platformGeometry, platformMaterial);
        platform.position.set(position.x, towerHeight, position.z);
        platform.castShadow = true;
        this.scene.add(platform);

        this.towers.push({ pole, platform });

        // --- Spotlights ---
        // 4 spotlights per tower, arranged in a cross pattern
        const spotlightOffsets = [
            { x: -1.5, z: 0 },    // Left
            { x: 1.5, z: 0 },     // Right
            { x: 0, z: -1.5 },    // Back
            { x: 0, z: 1.5 }      // Front
        ];

        spotlightOffsets.forEach((offset, i) => {
            this.createSpotlight(
                position.x + offset.x,
                towerHeight + 0.5,
                position.z + offset.z,
                index * 4 + i
            );
        });
    }

    /**
     * Create a single spotlight
     */
    createSpotlight(x, y, z, index) {
        // Spotlight fixture (small cylinder/box)
        const fixtureGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 6);
        const fixtureMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            emissive: 0x000000 // Will change when light is on
        });
        const fixture = new THREE.Mesh(fixtureGeometry, fixtureMaterial);
        fixture.position.set(x, y, z);
        fixture.rotation.x = Math.PI / 4; // Angled down
        this.scene.add(fixture);

        // SpotLight - warmer color, less intense
        const spotlight = new THREE.SpotLight(
            0xffd580,  // Warmer yellow instead of white
            0,         // Start with 0 intensity
            100,       // Distance
            Math.PI / 6,  // Angle
            0.3,       // Penumbra (soft edges)
            1          // Decay
        );
        spotlight.position.set(x, y, z);

        // Target the center of the pitch
        spotlight.target.position.set(0, 0, 0);
        this.scene.add(spotlight.target);

        // Start with lights off
        spotlight.visible = false;

        this.scene.add(spotlight);

        // Small glow sphere near light (just to show it's on)
        const glowRadius = 7; // Small radius (5-10m as requested)
        const glowGeometry = new THREE.SphereGeometry(glowRadius, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffd580,
            transparent: true,
            opacity: 0.05, // Very subtle
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
        glowSphere.position.set(x, y, z);
        glowSphere.visible = false; // Start hidden
        this.scene.add(glowSphere);

        this.lights.push({ spotlight, fixture, fixtureMaterial, glowSphere });
    }

    /**
     * Toggle stadium lights on/off
     */
    toggle() {
        this.isEnabled = !this.isEnabled;

        this.lights.forEach(({ spotlight, fixtureMaterial, glowSphere }) => {
            spotlight.visible = this.isEnabled;
            glowSphere.visible = this.isEnabled; // Show/hide glow with light

            // Update fixture appearance
            if (this.isEnabled) {
                // Light on - warm glow, lower intensity
                spotlight.intensity = 2.0;  // Reduced from 3.5
                fixtureMaterial.emissive.setHex(0xffaa00);
                fixtureMaterial.emissiveIntensity = 0.6;  // Reduced from 0.8
            } else {
                // Light off
                spotlight.intensity = 0;
                fixtureMaterial.emissive.setHex(0x000000);
                fixtureMaterial.emissiveIntensity = 0;
            }
        });

        // Toggle ambient light for night mode
        if (this.ambientLight) {
            this.ambientLight.intensity = this.isEnabled ? 0.3 : 0; // Subtle ambient light
        }

        console.log(`💡 Stadium lights: ${this.isEnabled ? 'ON' : 'OFF'}`);
        return this.isEnabled;
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.lights.forEach(({ spotlight }) => {
            spotlight.dispose();
        });
        this.towers.forEach(({ pole, platform }) => {
            pole.geometry.dispose();
            pole.material.dispose();
            platform.geometry.dispose();
            platform.material.dispose();
        });
    }
}
