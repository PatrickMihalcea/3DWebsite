import {
  Component,
  ElementRef,
  Inject,
  PLATFORM_ID,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { LoadingManagerService } from '../Services/loading-manager.service';

@Component({
  selector: 'app-sphere',
  standalone: true,
  template: '<div class="sphere-container"></div>',
  styles: [`
    .sphere-container {
      width: 100%;
      height: 100%;
      display: block;
      position: relative;
      overflow: hidden;
    }
  `]
})
export class Sphere implements AfterViewInit, OnDestroy {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;

  private isBrowser = false;
  private frameId: number | null = null;

  // Optional: keep reference for cleanup
  private resizeHandler = () => this.onResize();

  constructor(
    private elRef: ElementRef,
    private loadingService: LoadingManagerService,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    // Prevent SSR from running Three.js / window calls
    if (!this.isBrowser) return;

    this.initScene();
    this.addLights();
    this.addOrbitControls();
    this.loadModel();
    this.animate();

    window.addEventListener('resize', this.resizeHandler);
  }

  private initScene(): void {
    const container = this.elRef.nativeElement.querySelector('.sphere-container') as HTMLElement;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(
      75,
      (width || window.innerWidth) / (height || window.innerHeight),
      0.1,
      1000
    );
    this.camera.position.set(2, 3, 5);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width || window.innerWidth, height || window.innerHeight);

    container.appendChild(this.renderer.domElement);
  }

  private loadModel(): void {
    const loader = new GLTFLoader(this.loadingService.getManager());
    loader.load(
      'assets/models/ufo/scene.gltf',
      (gltf) => {
        const model = gltf.scene;
        model.scale.set(1, 1, 1);
        this.scene.add(model);
      },
      undefined,
      (error) => console.error('Error loading GLTF model', error)
    );
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 5));

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 10, 7.5);
    directionalLight.castShadow = true;
    this.scene.add(directionalLight);

    const hemisphereLight = new THREE.HemisphereLight(0xaaaaaa, 0x444444);
    hemisphereLight.position.set(0, 20, 0);
    this.scene.add(hemisphereLight);
  }

  private addOrbitControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.1;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 1.0;
    this.controls.maxPolarAngle = Math.PI / 2;
  }

  private animate = (): void => {
    this.frameId = window.requestAnimationFrame(this.animate);
    this.controls?.update();
    this.renderer?.render(this.scene, this.camera);
  };

  private onResize(): void {
    if (!this.renderer || !this.camera) return;

    const container = this.elRef.nativeElement.querySelector('.sphere-container') as HTMLElement;
    if (!container) return;

    const { width, height } = container.getBoundingClientRect();
    const w = width || window.innerWidth;
    const h = height || window.innerHeight;

    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    window.removeEventListener('resize', this.resizeHandler);

    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    this.controls?.dispose();

    // Dispose renderer + remove canvas
    if (this.renderer) {
      this.renderer.dispose();
      const canvas = this.renderer.domElement;
      canvas?.parentElement?.removeChild(canvas);
    }

    // Optional: dispose scene resources (good habit if you add lots of meshes/textures)
    this.scene?.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();

      const mat = (mesh as any).material;
      if (mat) {
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
        else mat.dispose?.();
      }
    });
  }
}
