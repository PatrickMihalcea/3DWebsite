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
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
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

  // Cow spawner (multiple cows)
  private cowTemplate: THREE.Object3D | null = null;
  private cowClips: THREE.AnimationClip[] = [];
  private cowNextSpawnTime: number | null = null; // seconds since scene start
  private cows: Array<{
    wrapper: THREE.Group;
    model: THREE.Object3D;
    spawnTime: number;
    startQuat: THREE.Quaternion;
    endQuat: THREE.Quaternion;
    mixer: THREE.AnimationMixer | null;
    action: THREE.AnimationAction | null;
  }> = [];

  // Knobs
  public firstCowTime = 10.0; // seconds after scene start when first cow begins rising
  public cowSpawnIntervalMinSec = 30.0; // random interval (seconds) min
  public cowSpawnIntervalMaxSec = 50.0; // random interval (seconds) max
  public cowMaxActive = 3; // safety cap

  private cowAnimSpeed = 1.0;
  private cowAnimIndex = 0;
  private readonly animateUfo = true;
  private cowRiseDurationSec = 35.0;
  private cowStartPos = new THREE.Vector3(0, -6, -1);
  private cowEndPos = new THREE.Vector3(0, 2, -0.25); // tweak to place under UFO

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
    // UFO
    loader.load(
      'assets/models/ufo/scene.gltf',
      (gltf) => {
        const model = gltf.scene;
        this.ufo = model;
        // Initialize pose to first checkpoint and start the flight.
        this.applyCheckpointPose(model, this.checkpoints[0]);
        this.flightStartTime = this.animateUfo ? this.clock.elapsedTime : null;

        this.scene.add(model);
      },
      undefined,
      (error) => console.error('Error loading UFO model', error)
    );

    // Cow
    loader.load(
      'assets/models/cow/scene.gltf',
      (gltf) => {
        this.cowTemplate = gltf.scene;
        this.cowClips = gltf.animations ?? [];

        // Debug: list clips once
        // eslint-disable-next-line no-console
        console.log(
          '[cow] animations:',
          this.cowClips.map((a, i) => ({ i, name: a.name, duration: a.duration, tracks: a.tracks.length }))
        );

        // Arm the spawner
        this.cowNextSpawnTime = this.firstCowTime;
      },
      undefined,
      (error) => console.error('Error loading cow model', error)
    );
  }

  private spawnCow(now: number): void {
    if (!this.cowTemplate) return;
    if (this.cows.length >= this.cowMaxActive) return;

    const cowModel = skeletonClone(this.cowTemplate) as THREE.Object3D;

    const wrapper = new THREE.Group();
    wrapper.position.copy(this.cowStartPos);
    wrapper.scale.setScalar(0.0015);

    const startQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      'XYZ'
    ));
    const endQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      THREE.MathUtils.randFloat(0, Math.PI * 2),
      'XYZ'
    ));
    wrapper.quaternion.copy(startQuat);

    // Keep model local transform neutral
    cowModel.position.set(0, 0, 0);
    cowModel.rotation.set(0, 0, 0);
    cowModel.scale.setScalar(1);
    wrapper.add(cowModel);

    let mixer: THREE.AnimationMixer | null = null;
    let action: THREE.AnimationAction | null = null;
    if (this.cowClips.length > 0) {
      const clip = this.cowClips[this.cowAnimIndex] ?? this.cowClips[0];
      mixer = new THREE.AnimationMixer(cowModel);
      action = mixer.clipAction(clip);
      action.reset();
      action.enabled = true;
      action.setEffectiveWeight(1);
      action.setEffectiveTimeScale(this.cowAnimSpeed);
      action.play();
    }

    this.cows.push({ wrapper, model: cowModel, spawnTime: now, startQuat, endQuat, mixer, action });
    this.scene.add(wrapper);
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
    this.cameraReturnStartTime = this.clock.elapsedTime;

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
    // IMPORTANT: getElapsedTime() internally calls getDelta(), so calling both will make dt ~0.
    // Use getDelta() once per frame, and read clock.elapsedTime for "now".
    const dt = this.clock.getDelta();
    const now = this.clock.elapsedTime;

    const returningCamera = !this.orbitInteracting && this.updateCameraReturn(now);

    if (!returningCamera && this.flightStartTime !== null && !this.orbitInteracting) {
      const elapsed = now - this.flightStartTime;
      const active = this.updateFlightAnimation(elapsed);
      if (!active) {
        this.flightStartTime = null;
        this.setControlsEnabled(true);
      }
    }

    // Spawn cows on a randomized interval
    if (this.cowTemplate && this.cowNextSpawnTime !== null && now >= this.cowNextSpawnTime) {
      this.spawnCow(now);
      const min = Math.max(0.1, this.cowSpawnIntervalMinSec);
      const max = Math.max(min, this.cowSpawnIntervalMaxSec);
      this.cowNextSpawnTime = now + THREE.MathUtils.randFloat(min, max);
    }

    // Update cows: rise + rotate + clip. Destroy when reaching end position.
    if (this.cows.length) {
      const dead: number[] = [];
      for (let i = 0; i < this.cows.length; i++) {
        const c = this.cows[i];
        const rawT = (now - c.spawnTime) / this.cowRiseDurationSec;
        const t = THREE.MathUtils.clamp(rawT, 0, 1);
        const e = this.easeOutCubic(t);

        c.wrapper.position.lerpVectors(this.cowStartPos, this.cowEndPos, e);
        c.wrapper.quaternion.copy(c.startQuat).slerp(c.endQuat, e);

        if (c.action && !c.action.isRunning()) c.action.reset().play();
        c.mixer?.update(dt);

        if (rawT >= 1) dead.push(i);
      }

      for (let k = dead.length - 1; k >= 0; k--) {
        const idx = dead[k];
        const c = this.cows[idx];
        c.action?.stop();
        c.mixer?.uncacheRoot(c.model);
        this.scene.remove(c.wrapper);
        this.cows.splice(idx, 1);
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

    // Remove any spawned cows
    for (const c of this.cows) {
      c.action?.stop();
      c.mixer?.uncacheRoot(c.model);
      this.scene?.remove(c.wrapper);
    }
    this.cows = [];

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
