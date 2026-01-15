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
import { TextRig } from '../three/text-rig';

@Component({
  selector: 'app-hero-scene',
  standalone: true,
  template: `<div class="hero3d"></div>`,
  styles: [`
    :host { display: block; }
    .hero3d {
      width: 100%;
      height: 100vh;
      background: #f5f5f2;
      overflow: hidden;
      position: relative;
      touch-action: none; /* important for pointer dragging on mobile */
    }
  `]
})
export class HeroSceneComponent implements AfterViewInit, OnDestroy {
  private isBrowser = false;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;

  private clock = new THREE.Clock();
  private frameId: number | null = null;

  private resizeHandler = () => this.onResize();

  private rigs: TextRig[] = [];
  private titleRig!: TextRig;
  private subtitleRig!: TextRig;

  // Attachment spring (subtitle)
  private subtitleY = 0;
  private subtitleYVel = 0;
  private subtitleGap = 0.35;

  // Pointer / grabbing state
  private activeRig: TextRig | null = null;
  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private anchorX = 0; // [-1..1] in rig box
  private anchorY = 0; // [-1..1] in rig box

  // How many pixels to drag for "full pull"
  private pullRadiusPx = 220;

  // Pointer handlers
  private pointerDownHandler = (ev: PointerEvent) => this.onPointerDown(ev);
  private pointerMoveHandler = (ev: PointerEvent) => this.onPointerMove(ev);
  private pointerUpHandler = (ev: PointerEvent) => this.onPointerUp(ev);

  constructor(
    private elRef: ElementRef,
    @Inject(PLATFORM_ID) platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    this.initScene();
    this.addLights();
    this.createText();

    window.addEventListener('resize', this.resizeHandler);

    const container = this.getContainer();
    container.addEventListener('pointerdown', this.pointerDownHandler, { passive: false });
    container.addEventListener('pointermove', this.pointerMoveHandler, { passive: false });
    container.addEventListener('pointerup', this.pointerUpHandler, { passive: false });
    container.addEventListener('pointercancel', this.pointerUpHandler, { passive: false });

    this.animate();
    requestAnimationFrame(() => this.onResize());
  }

  private getContainer(): HTMLElement {
    const el = this.elRef.nativeElement.querySelector('.hero3d') as HTMLElement | null;
    if (!el) throw new Error('Hero container (.hero3d) not found');
    return el;
  }

  private initScene(): void {
    const container = this.getContainer();
    const { width, height } = container.getBoundingClientRect();

    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 10);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0xf5f5f2, 1);

    container.appendChild(this.renderer.domElement);
  }

  private addLights(): void {
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    const key = new THREE.DirectionalLight(0xffffff, 1.25);
    key.position.set(6, 6, 8);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xffffff, 0.55);
    fill.position.set(-7, 2, 6);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.7);
    rim.position.set(0, 6, -8);
    this.scene.add(rim);
  }

  private createText(): void {
    const fontUrl = 'assets/fonts/helvetiker_regular.typeface.json';

    this.titleRig = new TextRig({
      fontUrl,
      text: 'PATRICK MIHALCEA',
      size: 1.0,
      height: 0.18,
      orbitIntensity: 0.18,
      positionalFloatingIntensity: 0.10,
      phobiaSensitivity: -0.25,
      speed: 0.8,
      textAlignment: 'center',
      minScale: 0.75,
      wrapSpringIntensity: 0.15,

      // Grab feel
      grabTiltIntensity: 0.1,
      grabMotionIntensity: 0.1,
    });

    this.titleRig.group.position.set(0, 0.35, 0);
    this.titleRig.captureBasePose();
    this.scene.add(this.titleRig.group);

    const subtitleMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.15,
      roughness: 0.45,
    });

    this.subtitleRig = new TextRig({
      fontUrl,
      text: 'SOFTWARE ENGINEER • THREE.JS • ANGULAR',
      size: 0.33,
      height: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.006,
      bevelSegments: 2,
      orbitIntensity: 0.10,
      positionalFloatingIntensity: 0.06,
      phobiaSensitivity: -0.22,
      speed: 0.75,
      textAlignment: 'center',
      minScale: 0.8,
      material: subtitleMaterial,
      wrapSpringIntensity: 0.20,

      // Grab feel
      grabTiltIntensity: 0.55,
      grabMotionIntensity: 0.35,
    });

    this.subtitleRig.group.position.set(0, -0.4, 0);
    this.subtitleRig.captureBasePose();
    this.scene.add(this.subtitleRig.group);

    this.subtitleY = this.subtitleRig.group.position.y;
    this.subtitleYVel = 0;

    this.rigs = [this.titleRig, this.subtitleRig];
  }

  private animate = (): void => {
    this.frameId = window.requestAnimationFrame(this.animate);

    const dt = this.clock.getDelta();

    for (const rig of this.rigs) rig.update(dt);

    this.updateSubtitleAttachment(dt);

    this.renderer.render(this.scene, this.camera);
  };

  private updateSubtitleAttachment(dt: number): void {
    const titleBounds = this.titleRig.getBoundsWorld();
    const subtitleBounds = this.subtitleRig.getBoundsWorld();
    if (titleBounds.height === 0 || subtitleBounds.height === 0) return;

    const titleY = this.titleRig.group.position.y;

    const targetSubtitleY =
      titleY
      - (titleBounds.height * 0.5)
      - this.subtitleGap
      - (subtitleBounds.height * 0.5);

    const k = 55;
    const c = 2 * Math.sqrt(k) * 0.95;

    const x = this.subtitleY - targetSubtitleY;
    const a = -k * x - c * this.subtitleYVel;

    this.subtitleYVel += a * dt;
    this.subtitleY += this.subtitleYVel * dt;

    this.subtitleRig.group.position.x = this.titleRig.group.position.x;
    this.subtitleRig.group.position.y = this.subtitleY;
  }

  private onResize(): void {
    const container = this.getContainer();
    if (!this.camera || !this.renderer) return;

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.position.z = (width / height) < 0.8 ? 12 : 10;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);

    // available width at z=0
    const textPlaneZ = 0;
    const distance = Math.abs(this.camera.position.z - textPlaneZ);
    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);

    const visibleHeight = 2 * Math.tan(vFovRad / 2) * distance;
    const visibleWidth = visibleHeight * this.camera.aspect;

    const padding = 0.88;
    const maxWidthWorld = visibleWidth * padding;

    for (const rig of this.rigs) rig.layoutForWidthWorld(maxWidthWorld);
  }

  // ---------- Grab logic (screen-space boxes) ----------

  private onPointerDown(ev: PointerEvent): void {
    const container = this.getContainer();
    container.setPointerCapture(ev.pointerId);

    const rect = container.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // Choose which rig is grabbed: title first, then subtitle
    const hit = this.pickRigAtScreenPoint(x, y);
    if (!hit) {
      this.activeRig = null;
      this.pointerId = null;
      return;
    }

    this.activeRig = hit.rig;
    this.pointerId = ev.pointerId;

    this.startX = x;
    this.startY = y;

    this.anchorX = hit.anchorX;
    this.anchorY = hit.anchorY;

    this.activeRig.beginGrab(this.anchorX, this.anchorY);

    ev.preventDefault();
  }

  private onPointerMove(ev: PointerEvent): void {
    const container = this.getContainer();
    const rect = container.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;

    // ✅ Always update pointer for phobia (normalized -1..1)
    const nx = (x / rect.width) * 2 - 1;
    const ny = -((y / rect.height) * 2 - 1);

    for (const rig of this.rigs) {
      rig.setPointer(nx, ny);
    }

    // If currently grabbing, also update grab pull
    if (this.activeRig && this.pointerId === ev.pointerId) {
      const dx = x - this.startX;
      const dy = y - this.startY;

      const pullX = THREE.MathUtils.clamp(dx / this.pullRadiusPx, -1, 1);
      const pullY = THREE.MathUtils.clamp(-dy / this.pullRadiusPx, -1, 1);

      this.activeRig.updateGrab(pullX, pullY);
      ev.preventDefault();
    }
  }

  private onPointerUp(ev: PointerEvent): void {
    if (this.pointerId === ev.pointerId && this.activeRig) {
      this.activeRig.endGrab();
    }
    this.activeRig = null;
    this.pointerId = null;
  }

  private pickRigAtScreenPoint(x: number, y: number):
    | { rig: TextRig; anchorX: number; anchorY: number }
    | null {
    const container = this.getContainer();
    const { width, height } = container.getBoundingClientRect();

    // prefer title then subtitle for luxury feel
    const ordered = [this.titleRig, this.subtitleRig];

    for (const rig of ordered) {
      const r = this.getRigScreenRect(rig, width, height);
      if (!r) continue;

      if (x >= r.minX && x <= r.maxX && y >= r.minY && y <= r.maxY) {
        const u = (x - r.minX) / Math.max(1e-6, r.maxX - r.minX); // 0..1
        const v = (y - r.minY) / Math.max(1e-6, r.maxY - r.minY); // 0..1

        const anchorX = THREE.MathUtils.clamp(u * 2 - 1, -1, 1);
        const anchorY = THREE.MathUtils.clamp(v * 2 - 1, -1, 1);

        return { rig, anchorX, anchorY };
      }
    }

    return null;
  }

  private getRigScreenRect(rig: TextRig, viewportW: number, viewportH: number):
    | { minX: number; minY: number; maxX: number; maxY: number }
    | null {
    const bounds = rig.getBoundsWorld();
    if (bounds.width <= 0 || bounds.height <= 0) return null;

    const center = new THREE.Vector3();
    rig.group.getWorldPosition(center);

    const halfW = bounds.width * 0.5;
    const halfH = bounds.height * 0.5;

    // World corners (axis-aligned box approximation)
    const corners = [
      new THREE.Vector3(center.x - halfW, center.y - halfH, center.z),
      new THREE.Vector3(center.x - halfW, center.y + halfH, center.z),
      new THREE.Vector3(center.x + halfW, center.y - halfH, center.z),
      new THREE.Vector3(center.x + halfW, center.y + halfH, center.z),
    ];

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const p of corners) {
      const ndc = p.clone().project(this.camera);
      const sx = (ndc.x + 1) * 0.5 * viewportW;
      const sy = (1 - (ndc.y + 1) * 0.5) * viewportH;

      minX = Math.min(minX, sx);
      minY = Math.min(minY, sy);
      maxX = Math.max(maxX, sx);
      maxY = Math.max(maxY, sy);
    }

    if (!isFinite(minX) || !isFinite(maxX)) return null;

    return { minX, minY, maxX, maxY };
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    window.removeEventListener('resize', this.resizeHandler);

    const container = this.getContainer();
    container.removeEventListener('pointerdown', this.pointerDownHandler);
    container.removeEventListener('pointermove', this.pointerMoveHandler);
    container.removeEventListener('pointerup', this.pointerUpHandler);
    container.removeEventListener('pointercancel', this.pointerUpHandler);

    if (this.frameId !== null) {
      window.cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    for (const rig of this.rigs) rig.dispose();
    this.rigs = [];

    if (this.renderer) {
      this.renderer.dispose();
      const canvas = this.renderer.domElement;
      canvas?.parentElement?.removeChild(canvas);
    }
  }
}
