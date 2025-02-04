import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


// Set up the scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);

// Camera setup
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 1, 1000);
camera.position.set(4, 5, 4);
camera.lookAt(0,0,0);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Ground Geometry
const groundGeometry = new THREE.PlaneGeometry(10, 10, 10, 10);
groundGeometry.rotateX(-Math.PI / 2);
const groundMaterial = new THREE.MeshStandardMaterial({
  color: 0x555555,
  side: THREE.DoubleSide
});
const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
groundMesh.castShadow = false;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// Lighting
const light = new THREE.SpotLight(0xffffff, 30000, 100, 0.22, 1);
light.position.set(0, 24, 0);
scene.add(light);

// Load GLTF model
const loader = new GLTFLoader();
loader.load('Assets/Porche911/scene.gltf', (gltf) => {
    scene.add(gltf.scene);
}, undefined, (error) => {
    console.error('Error loading model:', error);
});

// Add orbit controls (for rotating the model)
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // Smooth movement

// Animation loop
function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
