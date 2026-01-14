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
      background: #f5f5f2; /* light but bold */
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

  private rigs: TextRig[] = [];

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
    this.animate();
  }

  private initScene(): void {
    const container = this.elRef.nativeElement.querySelector('.hero3d') as HTMLElement;
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
    // Minimal "studio" lighting for a luxury feel
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

    // One rig = one uniform motion unit.
    // Start with full name as one unit.
    const rig = new TextRig({
      fontUrl,
      text: 'PATRICK MIHALCEA',
      size: 1,
      height: 0.18,
      orbitIntensity: 0.58, // 0..1
      positionalFloatingIntensity: 2.6, // 0..1
      speed: 0.8,
      phase: 0.0,
    });

    rig.group.position.set(0, 0, 0);
    this.scene.add(rig.group);

    // Capture base pose AFTER positioning
    rig.captureBasePose();

    this.rigs = [rig];

    // If you want two independent rigs later, swap to:
    // const first = new TextRig({ fontUrl, text: 'PATRICK', size: 1.1, height: 0.18, orbitIntensity: 0.18, positionalFloatingIntensity: 0.10, phase: 0.0 });
    // const last  = new TextRig({ fontUrl, text: 'MIHALCEA', size: 1.1, height: 0.18, orbitIntensity: 0.18, positionalFloatingIntensity: 0.10, phase: 1.2 });
    // first.group.position.set(-2.2, 0.15, 0); last.group.position.set(2.2, -0.15, 0);
    // this.scene.add(first.group, last.group);
    // first.captureBasePose(); last.captureBasePose();
    // this.rigs = [first, last];
  }

  private animate = (): void => {
    this.frameId = window.requestAnimationFrame(this.animate);

    const dt = this.clock.getDelta();
    for (const rig of this.rigs) rig.update(dt);

    this.renderer.render(this.scene, this.camera);
  };

  private onResize(): void {
    const container = this.elRef.nativeElement.querySelector('.hero3d') as HTMLElement;
    if (!container || !this.camera || !this.renderer) return;

    const { width, height } = container.getBoundingClientRect();
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.setSize(width, height);

    // Optional: adaptive camera distance for portrait screens
    this.camera.position.z = (width / height) < 0.8 ? 12 : 10;
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;

    window.removeEventListener('resize', this.resizeHandler);

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
