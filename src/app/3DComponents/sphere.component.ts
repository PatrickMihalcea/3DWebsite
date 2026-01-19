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

type AccelerationMode = 'up' | 'down' | 'linear' | 'arc';

type AnimationCheckpoint = {
  time: number; // seconds since animation start
  position: [number, number, number];
  angle: [number, number, number]; // radians (x,y,z)
  acceleration: AccelerationMode;
  /**
   * Uniform scale for the model at this checkpoint.
   * Interpolated between checkpoints across each segment.
   */
  scale: number;
};

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
  private clock = new THREE.Clock();

  /**
   * Flight animation is driven by checkpoints.
   *
   * - `time` is seconds from the start of the animation.
   * - First checkpoint MUST have `time: 0`.
   * - Each segment interpolates from checkpoint[i] -> checkpoint[i+1].
   * - Segment easing is controlled by checkpoint[i+1].acceleration:
   *   - 'up'     => ease-in (speeds up into the new position)
   *   - 'down'   => ease-out (slows down into the new position)
   *   - 'arc'    => ease-in-out (speeds up to midpoint, slows down to target)
   *   - 'linear' => constant speed
   */
  private ufo: THREE.Object3D | null = null;
  private flightStartTime: number | null = null;

  // After OrbitControls interaction, smoothly return camera to its original pose.
  private orbitInteracting = false;
  private cameraReturnStartTime: number | null = null;
  private cameraReturnDurationSec = 1.2;

  private cameraHomePos = new THREE.Vector3();
  private targetHome = new THREE.Vector3();
  private cameraReturnFromPos = new THREE.Vector3();
  private targetReturnFrom = new THREE.Vector3();

  private orbitStartHandler = () => this.onOrbitStart();
  private orbitEndHandler = () => this.onOrbitEnd();

  // Gentle camera bob (adds a small reversible offset so it doesn't drift)
  private cameraBobEnabled = true;
  private cameraBobAmpY = 0.1;
  private cameraBobAmpX = 0.3;
  private cameraBobAmpZ = 0;
  private cameraBobHz = 0.05; // cycles per second
  private cameraBobPrev = new THREE.Vector3();
  private cameraBobActiveLastFrame = false;

  // Edit this array to design new animations quickly.
  private readonly checkpoints: AnimationCheckpoint[] = [
    { time: 0, position: [10, 6, -10], angle: [0.2, -2.4, 0], acceleration: 'linear', scale: 0.0001 },
    // { time: 0, position: [-15, -3, -10], angle: [0, -0.6, -0.1], acceleration: 'linear', scale: 0.8 },
    // { time: 3.25, position: [-16, -3.2, -10], angle: [0, -0.7, -0.2], acceleration: 'linear', scale: 1 },
    { time: 3, position: [-3, -1, 0], angle: [-1, -1.0, -1.0], acceleration: 'arc', scale: 0.95 },
    { time: 6, position: [0, 0.7, 0.12], angle: [0, 0, 0], acceleration: 'arc', scale: 1 },
  ];

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
    this.camera.position.set(2, 0.5, 5);

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
        this.ufo = model;
        // Initialize pose to first checkpoint and start the flight.
        this.applyCheckpointPose(model, this.checkpoints[0]);
        this.flightStartTime = this.clock.getElapsedTime();
        this.setControlsEnabled(false);

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
    // Disable scroll/pinch zoom (dolly) entirely
    this.controls.enableZoom = false;
    this.controls.enablePan = false;
    // Limit vertical orbit (polar angle) so the camera can't go too far above/below the UFO.
    // Polar angle is measured from "up": 0 = directly above, PI/2 = horizon, PI = directly below.
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(75);  // don't go too high
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(93); // don't go too low

    // Save home camera pose (used for smooth return after orbiting).
    this.cameraHomePos.copy(this.camera.position);
    this.targetHome.copy(this.controls.target);

    // Start/end fire when user begins/ends interaction.
    this.controls.addEventListener('start', this.orbitStartHandler);
    this.controls.addEventListener('end', this.orbitEndHandler);
  }

  private setControlsEnabled(enabled: boolean): void {
    if (!this.controls) return;
    this.controls.enabled = enabled;
    this.controls.autoRotate = enabled;
  }

  private onOrbitStart(): void {
    this.orbitInteracting = true;
    // Cancel any return tween while the user is interacting.
    this.cameraReturnStartTime = null;

    // Remove any bob offset so OrbitControls works from the true camera pose.
    this.camera.position.sub(this.cameraBobPrev);
    this.cameraBobPrev.set(0, 0, 0);
  }

  private onOrbitEnd(): void {
    this.orbitInteracting = false;
    if (!this.controls) return;

    // Ensure return tween starts from the true pose (without bob).
    this.camera.position.sub(this.cameraBobPrev);
    this.cameraBobPrev.set(0, 0, 0);

    // Start a smooth return to home camera + target.
    this.cameraReturnFromPos.copy(this.camera.position);
    this.targetReturnFrom.copy(this.controls.target);
    this.cameraReturnStartTime = this.clock.getElapsedTime();

    // Disable controls during the return tween so inertia doesn't fight it.
    this.controls.enabled = false;
    this.controls.autoRotate = false;
  }

  private updateCameraReturn(now: number): boolean {
    if (!this.controls) return false;
    if (this.cameraReturnStartTime === null) return false;

    const t = Math.min(Math.max((now - this.cameraReturnStartTime) / this.cameraReturnDurationSec, 0), 1);
    const e = this.easeOutCubic(t);

    this.camera.position.lerpVectors(this.cameraReturnFromPos, this.cameraHomePos, e);
    this.controls.target.lerpVectors(this.targetReturnFrom, this.targetHome, e);
    this.controls.update();

    if (t >= 1) {
      this.camera.position.copy(this.cameraHomePos);
      this.controls.target.copy(this.targetHome);
      this.controls.update();
      this.cameraReturnStartTime = null;

      // Re-enable orbiting after returning home.
      this.controls.enabled = true;
      this.controls.autoRotate = true;
      return false;
    }

    return true;
  }

  private updateCameraBob(now: number): void {
    if (!this.cameraBobEnabled) return;
    const active = !this.orbitInteracting && this.cameraReturnStartTime === null;
    if (!active) {
      this.cameraBobActiveLastFrame = false;
      return;
    }

    const w = 2 * Math.PI * this.cameraBobHz;
    // Slightly different phases so it feels organic.
    const x = Math.sin(w * now) * this.cameraBobAmpX;
    const y = Math.sin(w * now + 1.4) * this.cameraBobAmpY;
    const z = Math.cos(w * now + 0.7) * this.cameraBobAmpZ;

    const next = new THREE.Vector3(x, y, z);

    // Avoid a one-frame "jump" when bob resumes after orbit/return.
    if (!this.cameraBobActiveLastFrame) {
      this.cameraBobPrev.copy(next);
      this.cameraBobActiveLastFrame = true;
      return;
    }

    const delta = next.clone().sub(this.cameraBobPrev);
    this.camera.position.add(delta);
    this.cameraBobPrev.copy(next);
    this.cameraBobActiveLastFrame = true;
  }

  private easeInCubic(t: number): number {
    return t * t * t;
  }

  private easeOutCubic(t: number): number {
    return 1 - Math.pow(1 - t, 3);
  }

  /**
   * Quintic ease-in-out ("smootherstep"): very obvious slow-in + slow-out.
   * This matches the mental model of "speed up to midpoint, slow down after".
   */
  private easeInOutQuint(t: number): number {
    // 6t^5 - 15t^4 + 10t^3
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private easeLinear(t: number): number {
    return t;
  }

  private easeByMode(t: number, mode: AccelerationMode): number {
    if (mode === 'up') return this.easeInCubic(t);
    if (mode === 'down') return this.easeOutCubic(t);
    if (mode === 'arc') return this.easeInOutQuint(t);
    return this.easeLinear(t);
  }

  private applyCheckpointPose(
    obj: THREE.Object3D,
    cp: { position: [number, number, number]; angle: [number, number, number]; scale: number }
  ): void {
    obj.position.set(cp.position[0], cp.position[1], cp.position[2]);
    obj.rotation.set(cp.angle[0], cp.angle[1], cp.angle[2]);
    obj.scale.setScalar(cp.scale);
  }

  private updateFlightAnimation(elapsedSec: number): boolean {
    if (!this.ufo) return false;
    if (!this.checkpoints.length || this.checkpoints[0].time !== 0) return false;
    if (this.checkpoints.length < 2) return false;

    const last = this.checkpoints[this.checkpoints.length - 1];
    if (elapsedSec >= last.time) {
      this.applyCheckpointPose(this.ufo, last);
      return false;
    }

    // Find the current segment [a -> b] where a.time <= elapsed < b.time
    let idx = 0;
    for (let i = 0; i < this.checkpoints.length - 1; i++) {
      const a = this.checkpoints[i];
      const b = this.checkpoints[i + 1];
      if (elapsedSec >= a.time && elapsedSec < b.time) {
        idx = i;
        break;
      }
    }

    const a = this.checkpoints[idx];
    const b = this.checkpoints[idx + 1];
    const segDuration = Math.max(0.0001, b.time - a.time);
    const rawT = (elapsedSec - a.time) / segDuration;
    const t = Math.min(Math.max(rawT, 0), 1);
    const e = this.easeByMode(t, b.acceleration);

    // Position lerp
    const fromPos = new THREE.Vector3(a.position[0], a.position[1], a.position[2]);
    const toPos = new THREE.Vector3(b.position[0], b.position[1], b.position[2]);
    this.ufo.position.lerpVectors(fromPos, toPos, e);

    // Scale lerp
    const s = THREE.MathUtils.lerp(a.scale, b.scale, e);
    this.ufo.scale.setScalar(s);

    // Angle lerp (use quaternions to avoid weird wrap issues)
    const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(a.angle[0], a.angle[1], a.angle[2]));
    const qb = new THREE.Quaternion().setFromEuler(new THREE.Euler(b.angle[0], b.angle[1], b.angle[2]));
    this.ufo.quaternion.copy(qa).slerp(qb, e);

    return true;
  }

  private animate = (): void => {
    this.frameId = window.requestAnimationFrame(this.animate);
    const now = this.clock.getElapsedTime();
    this.clock.getDelta(); // keep internal time stable if you use dt later

    const returningCamera = !this.orbitInteracting && this.updateCameraReturn(now);

    if (!returningCamera && this.flightStartTime !== null && !this.orbitInteracting) {
      const elapsed = now - this.flightStartTime;
      const active = this.updateFlightAnimation(elapsed);
      if (!active) {
        this.flightStartTime = null;
        this.setControlsEnabled(true);
      }
    }

    // Let OrbitControls apply damping, then add bob on top so it doesn't fight controls.
    this.controls?.update();
    this.updateCameraBob(now);
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

    if (this.controls) {
      this.controls.removeEventListener('start', this.orbitStartHandler);
      this.controls.removeEventListener('end', this.orbitEndHandler);
      this.controls.dispose();
    }

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
