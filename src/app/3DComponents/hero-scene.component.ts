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
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TextRig } from '../three/text-rig';

@Component({
  selector: 'app-hero-scene',
  standalone: true,
  template: `<div class="hero3d"></div>`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .hero3d {
      width: 100%;
      height: 100%;
      /* Background is controlled globally (see src/styles.css). */
      background: transparent;
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

  // Anchors allow HTML-like placement without fighting TextRig internals:
  // - Anchor position = "where this block lives"
  // - TextRig.group animates relative to that anchor (float/phobia/grab)
  private titleAnchor!: THREE.Group;
  private subtitleAnchor!: THREE.Group;

  private clock = new THREE.Clock();
  private frameId: number | null = null;

  private resizeHandler = () => this.onResize();

  private rigs: TextRig[] = [];
  private titleRig!: TextRig;
  private subtitleRig!: TextRig;

  // Responsive alignment for title
  private readonly mobileBreakpointPx = 865;
  private currentTitleAlignment: 'left' | 'center' = 'left';
  private readonly titleMinScaleDesktop = 0.45;
  private readonly titleMinScaleMobile = 0.75;
  private currentTitleMinScale = this.titleMinScaleDesktop;

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

    this.titleAnchor = new THREE.Group();
    this.subtitleAnchor = new THREE.Group();
    this.scene.add(this.titleAnchor, this.subtitleAnchor);

    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    this.camera.position.set(0, 0, 10);

    // Transparent canvas so CSS background on `.hero3d` shows through.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(width, height);
    this.renderer.setClearAlpha(0);

    // Add an environment map so metals look reflective (still transparent background).
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

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

    const titleMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1b1b1b,
      metalness: 0.9,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });

    this.titleRig = new TextRig({
      fontUrl,
      text: 'DEVELOPER FOR OUT OF THIS WORLD IDEAS.',
      size: 1.0,
      height: 0.18,
      orbitIntensity: 0.18,
      positionalFloatingIntensity: 0.30,
      phobiaSensitivity: -0.35,
      speed: 0.8,
      textAlignment: 'left',
      minScale: this.titleMinScaleDesktop,
      wrapSpringIntensity: 0.15,
      material: titleMaterial,

      // Grab feel
      grabTiltIntensity: 0.1,
      grabMotionIntensity: 0.1,
    });

    // Title lives at the anchor; rig animates around (0,0,0) locally.
    this.titleRig.group.position.set(0, 0, 0);
    this.titleRig.captureBasePose();
    this.titleAnchor.position.set(0, this.subtitleGap, 0);
    this.titleAnchor.add(this.titleRig.group);

    const subtitleMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.15,
      roughness: 0.45,
    });

    this.subtitleRig = new TextRig({
      fontUrl,
      text: 'From "first contact", to production.',
      size: 0.27,
      height: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.006,
      bevelSegments: 2,
      orbitIntensity: 0.10,
      positionalFloatingIntensity: 0.06,
      phobiaSensitivity: -0.42,
      speed: 0.75,
      textAlignment: 'left',
      minScale: 0.8,
      material: subtitleMaterial,
      wrapSpringIntensity: 0.20,

      // Grab feel
      grabTiltIntensity: 0.55,
      grabMotionIntensity: 0.35,
    });

    // Subtitle also lives at an anchor (so attachment can move the anchor).
    this.subtitleRig.group.position.set(0, 0, 0);
    this.subtitleRig.captureBasePose();
    this.subtitleAnchor.position.set(0, -0.4, 0);
    this.subtitleAnchor.add(this.subtitleRig.group);

    this.subtitleY = this.subtitleAnchor.position.y;
    this.subtitleYVel = 0;

    this.rigs = [this.titleRig, this.subtitleRig];
  }

  private animate = (): void => {
    this.frameId = window.requestAnimationFrame(this.animate);

    const dt = this.clock.getDelta();

    for (const rig of this.rigs) rig.update(dt);

    if (!this.subtitleRig.isGrabActive()) {
      this.updateSubtitleAttachment(dt);
    }

    this.renderer.render(this.scene, this.camera);
  };

  private updateSubtitleAttachment(dt: number): void {
    const titleBounds = this.titleRig.getBoundsWorld();
    const subtitleBounds = this.subtitleRig.getBoundsWorld();
    if (titleBounds.height === 0 || subtitleBounds.height === 0) return;

    // Attach to the title's *rendered* position (anchor + rig local motion),
    // so the subtitle follows title float/grab smoothly too.
    const titleX = this.titleAnchor.position.x + this.titleRig.group.position.x;
    const titleY = this.titleAnchor.position.y + this.titleRig.group.position.y;

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

    this.subtitleAnchor.position.x = titleX;
    this.subtitleAnchor.position.y = this.subtitleY;
  }

  private onResize(): void {
    const container = this.getContainer();
    if (!this.camera || !this.renderer) return;

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    // Switch title alignment based on viewport width (desktop: left, mobile: center)
    const isMobile =
      typeof window !== 'undefined' &&
      (window.matchMedia?.(`(max-width: ${this.mobileBreakpointPx}px)`)?.matches ??
        window.innerWidth <= this.mobileBreakpointPx);
    const desiredTitleAlignment: 'left' | 'center' = isMobile ? 'center' : 'left';
    if (desiredTitleAlignment !== this.currentTitleAlignment) {
      this.currentTitleAlignment = desiredTitleAlignment;
      this.titleRig.setTextAlignment(desiredTitleAlignment);
    }

    // Responsive minScale: let the title stay larger on mobile before wrapping/shrinking.
    const desiredMinScale = isMobile ? this.titleMinScaleMobile : this.titleMinScaleDesktop;
    if (desiredMinScale !== this.currentTitleMinScale) {
      this.currentTitleMinScale = desiredMinScale;
      this.titleRig.setMinScale(desiredMinScale);
    }

    this.camera.aspect = width / height;
    // Smoothly adjust camera distance based on aspect (no breakpoint snap).
    const aspect = width / Math.max(1, height);
    const aMin = 0.60; // tall/mobile
    const aMax = 0.95; // wide/desktop-ish
    const t = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp(aspect, aMin, aMax), aMin, aMax);
    this.camera.position.z = THREE.MathUtils.lerp(12, 10, t);
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

    // If we're grabbing the subtitle, freeze the attachment spring at the
    // anchor's current position so it resumes smoothly on release.
    if (this.activeRig === this.subtitleRig) {
      this.subtitleY = this.subtitleAnchor.position.y;
      this.subtitleYVel = 0;
    }

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
      // Restart attachment spring from the anchor's current position.
      if (this.activeRig === this.subtitleRig) {
        this.subtitleY = this.subtitleAnchor.position.y;
        this.subtitleYVel = 0;
      }
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
