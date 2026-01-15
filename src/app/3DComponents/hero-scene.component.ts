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
  private mouseHandler = (ev: MouseEvent) => this.onMouseMove(ev);

  private rigs: TextRig[] = [];
  private titleRig!: TextRig;
  private subtitleRig!: TextRig;

  // Subtitle attachment spring
  private subtitleY = 0;
  private subtitleYVel = 0;

  // Layout tuning
  private subtitleGap = 0.35; // world units gap between title and subtitle

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

    // Input + resize
    window.addEventListener('resize', this.resizeHandler);

    const container = this.getContainer();
    container.addEventListener('mousemove', this.mouseHandler, { passive: true });
    container.addEventListener('mouseleave', () => {
      for (const rig of this.rigs) rig.setPointer(0, 0);
    });

    this.animate();

    // Force initial layout pass once mounted
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

    // Title
    this.titleRig = new TextRig({
      fontUrl,
      text: 'PATRICK MIHALCEA',
      size: 1.0,
      height: 0.18,
      orbitIntensity: 0.18,
      positionalFloatingIntensity: 0.10,
      phobiaSensitivity: -0.35,
      speed: 0.8,
      textAlignment: 'center',
      minScale: 0.75,
      wrapSpringIntensity: 0.15,
    });

    // You said title position in world space is fine:
    this.titleRig.group.position.set(0, 0.35, 0);
    this.titleRig.captureBasePose();
    this.scene.add(this.titleRig.group);

    // Subtitle
    const subtitleMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      metalness: 0.15,
      roughness: 0.45,
    });

    this.subtitleRig = new TextRig({
      fontUrl,
      text: 'SOFTWARE ENGINEER • THREE.JS • ANGULAR',
      size: 0.33,
      height: 0.04,
      bevelEnabled: true,
      bevelThickness: 0.01,
      bevelSize: 0.006,
      bevelSegments: 2,
      orbitIntensity: 0.3,
      positionalFloatingIntensity: 0.06,
      phobiaSensitivity: -0.12,
      speed: 0.75,
      textAlignment: 'center',
      minScale: 0.8,
      material: subtitleMaterial,
      wrapSpringIntensity: 0.20,
    });

    // Initial placement (will be overridden smoothly)
    this.subtitleRig.group.position.set(0, -0.4, 0);
    this.subtitleRig.captureBasePose();
    this.scene.add(this.subtitleRig.group);

    // Spring starts at current position
    this.subtitleY = this.subtitleRig.group.position.y;
    this.subtitleYVel = 0;

    this.rigs = [this.titleRig, this.subtitleRig];
  }

  private onMouseMove(ev: MouseEvent): void {
    const container = this.getContainer();
    const rect = container.getBoundingClientRect();

    const nx = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const ny = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

    for (const rig of this.rigs) rig.setPointer(nx, ny);
  }

  private animate = (): void => {
    this.frameId = window.requestAnimationFrame(this.animate);

    const dt = this.clock.getDelta();

    // Update rigs (internal motion + wrapping + scale)
    for (const rig of this.rigs) rig.update(dt);

    // ---- NEW: buttery subtitle attachment ----
    this.updateSubtitleAttachment(dt);

    this.renderer.render(this.scene, this.camera);
  };

  private updateSubtitleAttachment(dt: number): void {
    if (!this.titleRig || !this.subtitleRig) return;

    const titleBounds = this.titleRig.getBoundsWorld();
    const subtitleBounds = this.subtitleRig.getBoundsWorld();

    // If bounds aren't ready yet (font still loading), do nothing
    if (titleBounds.height === 0 || subtitleBounds.height === 0) return;

    // Title anchor is its group position (we keep this as your chosen world position)
    const titleY = this.titleRig.group.position.y;

    // Place subtitle directly below title block:
    const targetSubtitleY =
      titleY
      - (titleBounds.height * 0.5)
      - this.subtitleGap
      - (subtitleBounds.height * 0.5);

    // Critically damped-ish spring for buttery movement
    const k = 55; // stiffness (higher = snappier)
    const c = 2 * Math.sqrt(k) * 0.95; // damping

    const x = this.subtitleY - targetSubtitleY;
    const a = -k * x - c * this.subtitleYVel;

    this.subtitleYVel += a * dt;
    this.subtitleY += this.subtitleYVel * dt;

    // Apply
    this.subtitleRig.group.position.x = this.titleRig.group.position.x; // keep centered to title
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

    // Compute available world width at z=0 (text plane)
    const textPlaneZ = 0;
    const distance = Math.abs(this.camera.position.z - textPlaneZ);

    const vFovRad = THREE.MathUtils.degToRad(this.camera.fov);
    const visibleHeight = 2 * Math.tan(vFovRad / 2) * distance;
    const visibleWidth = visibleHeight * this.camera.aspect;

    const padding = 0.88;
    const maxWidthWorld = visibleWidth * padding;

    for (const rig of this.rigs) {
      rig.layoutForWidthWorld(maxWidthWorld);
    }
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    window.removeEventListener('resize', this.resizeHandler);

    try {
      const container = this.getContainer();
      container.removeEventListener('mousemove', this.mouseHandler);
    } catch {}

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
