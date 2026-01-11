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

        // SpotLight
        const spotlight = new THREE.SpotLight(0xfff8e1, 0, 100, Math.PI / 6, 0.3, 1);
        spotlight.position.set(x, y, z);

        // Target the center of the pitch
        spotlight.target.position.set(0, 0, 0);
        this.scene.add(spotlight.target);

        // Start with lights off
        spotlight.visible = false;

        this.scene.add(spotlight);
        this.lights.push({ spotlight, fixture, fixtureMaterial });
    }

    /**
     * Toggle stadium lights on/off
     */
    toggle() {
        this.isEnabled = !this.isEnabled;

        this.lights.forEach(({ spotlight, fixtureMaterial }) => {
            spotlight.visible = this.isEnabled;

            // Update fixture appearance
            if (this.isEnabled) {
                // Light on - emit warm glow
                spotlight.intensity = 3.5;
                fixtureMaterial.emissive.setHex(0xffaa00);
                fixtureMaterial.emissiveIntensity = 0.8;
            } else {
                // Light off
                spotlight.intensity = 0;
                fixtureMaterial.emissive.setHex(0x000000);
                fixtureMaterial.emissiveIntensity = 0;
            }
        });

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
