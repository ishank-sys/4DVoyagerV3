// Simple script to create a test GLB file for demonstration
import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import fs from 'fs';

// Create a simple scene with a cube
const scene = new THREE.Scene();

// Create a cube geometry
const geometry = new THREE.BoxGeometry(2, 2, 2);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 });
const cube = new THREE.Mesh(geometry, material);
cube.position.set(0, 1, 0);
scene.add(cube);

// Create a ground plane
const groundGeometry = new THREE.PlaneGeometry(10, 10);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

// Export to GLB
const exporter = new GLTFExporter();
exporter.parse(scene, (result) => {
    const buffer = result;
    fs.writeFileSync('./public/BSGS/BSGS_03_3D-Model-1024-1.glb', Buffer.from(buffer));
    console.log('Test GLB file created successfully!');
}, { binary: true });