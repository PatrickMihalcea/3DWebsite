// cube.component.ts
import { Component, ElementRef, OnInit } from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LoadingManagerService } from '../Services/loading-manager.service';


@Component({
  selector: 'app-galaxy',
  template: '<div class="galaxy-container"></div>',
})
export class Galaxy implements OnInit {
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  loadingManager!: THREE.LoadingManager;
  progress = 0;
  controls!: OrbitControls;

  constructor(private elRef: ElementRef, private loadingService: LoadingManagerService) {}

  ngOnInit(): void {
    this.initScene();
    this.loadModel();
    this.addLights();
    this.addOrbitControls();
    this.animate();
  }

  initScene() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(2,0,5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const container = this.elRef.nativeElement.querySelector('.galaxy-container');
    container.appendChild(this.renderer.domElement);
  }

  loadModel() {
    const geometry = new THREE.BufferGeometry()
    const particleCount = 1000

    const positions = new Float32Array(particleCount * 3)
    for(let i = 0; i < particleCount; i++)
        {
            const i3 = i * 3
    
            positions[i3    ] = (Math.random() - 0.5) * 3
            positions[i3 + 1] = (Math.random() - 0.5) * 3
            positions[i3 + 2] = (Math.random() - 0.5) * 3
        }
    
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        // Material
        const material = new THREE.PointsMaterial({
            size: 0.02,
            sizeAttenuation: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        })
        const points = new THREE.Points(geometry, material)
        this.scene.add(points)
    }

    
  

  addLights() {
    // Ambient light for basic illumination
    const ambientLight = new THREE.AmbientLight(0xffffff, 5);
    this.scene.add(ambientLight);

    // Directional light to simulate sunlight
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    // Optional: Add a Hemisphere light for soft sky-ground lighting
    const hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x444444);
    hemisphereLight.position.set(0, 20, 0);
    this.scene.add(hemisphereLight);
  }

  addOrbitControls() {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true; // Smooth camera movement
    this.controls.dampingFactor = 0.1;
    this.controls.autoRotate = true; // Enable if auto-rotation is desired
    this.controls.autoRotateSpeed = 1.0;
    this.controls.maxPolarAngle = Math.PI / 2; // Prevent camera from going below ground
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update(); // Required if damping is enabled
    this.renderer.render(this.scene, this.camera);
  }
}