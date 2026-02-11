import { AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy, ViewChild, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { NgxExtendedPdfViewerComponent, NgxExtendedPdfViewerModule, PageViewModeType, ScrollModeType, SpreadType, pdfDefaultOptions } from 'ngx-extended-pdf-viewer';

@Component({
  selector: 'app-resume',
  standalone: true,
  imports: [CommonModule, NgxExtendedPdfViewerModule],
  templateUrl: './resume.component.html',
  styleUrl: './resume.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResumeComponent implements AfterViewInit, OnDestroy {
  readonly pdfUrl = 'assets/documents/Patrick Mihalcea Resume.pdf';
  readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private raf1: number | null = null;
  private raf2: number | null = null;
  private readonly onResize = () => this.handleResize();
  private readonly onGesture = (e: Event) => e.preventDefault();
  private viewportMeta: HTMLMetaElement | null = null;
  private prevViewportContent: string | null = null;
  private createdViewportMeta = false;

  @ViewChild(NgxExtendedPdfViewerComponent)
  private pdf?: NgxExtendedPdfViewerComponent;

  zoom: 'page-fit' | 'page-width' | number = 'page-fit';
  pageViewMode: PageViewModeType = 'single';
  scrollMode: ScrollModeType = ScrollModeType.page;
  readonly spread: SpreadType = 'off';
  readonly showBorders = false;

  constructor() {
    if (this.isBrowser) {
      pdfDefaultOptions.assetsFolder = 'assets/ngx-extended-pdf-viewer';
    }
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    window.addEventListener('resize', this.onResize, { passive: true });
    this.lockViewportZoom();
    document.addEventListener('gesturestart', this.onGesture as EventListener, { passive: false } as AddEventListenerOptions);
    document.addEventListener('gesturechange', this.onGesture as EventListener, { passive: false } as AddEventListenerOptions);
    document.addEventListener('gestureend', this.onGesture as EventListener, { passive: false } as AddEventListenerOptions);
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    window.removeEventListener('resize', this.onResize);
    if (this.raf1 !== null) window.cancelAnimationFrame(this.raf1);
    if (this.raf2 !== null) window.cancelAnimationFrame(this.raf2);
    this.raf1 = null;
    this.raf2 = null;
    this.unlockViewportZoom();
    document.removeEventListener('gesturestart', this.onGesture as EventListener);
    document.removeEventListener('gesturechange', this.onGesture as EventListener);
    document.removeEventListener('gestureend', this.onGesture as EventListener);
  }

  zoomLabel(): string {
    if (typeof this.zoom === 'number') return `${this.zoom}%`;
    return this.zoom === 'page-width' ? 'Width' : 'Height';
  }

  adjustZoom(delta: number): void {
    const current = typeof this.zoom === 'number' ? this.zoom : 100;
    const next = Math.min(300, Math.max(40, current + delta));
    this.zoom = next;
    this.pageViewMode = 'multiple';
    this.scrollMode = ScrollModeType.vertical;
  }

  fitHeight(): void {
    this.zoom = 'page-fit';
    this.pageViewMode = 'single';
    this.scrollMode = ScrollModeType.page;
    this.scheduleRefit();
  }

  fitWidth(): void {
    this.zoom = 'page-width';
    this.pageViewMode = 'multiple';
    this.scrollMode = ScrollModeType.vertical;
    this.scheduleRefit();
  }

  private handleResize(): void {
    if (this.zoom === 'page-fit' || this.zoom === 'page-width') this.scheduleRefit();
  }

  private scheduleRefit(): void {
    if (!this.isBrowser) return;
    if (this.raf1 !== null) window.cancelAnimationFrame(this.raf1);
    if (this.raf2 !== null) window.cancelAnimationFrame(this.raf2);

    this.raf1 = window.requestAnimationFrame(() => {
      this.raf1 = null;
      this.raf2 = window.requestAnimationFrame(() => {
        this.raf2 = null;
        this.pdf?.onResize();
        (this.pdf as any)?.setZoom?.();
      });
    });
  }

  private lockViewportZoom(): void {
    const head = document.head;
    if (!head) return;

    const meta =
      (document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null) ??
      ((): HTMLMetaElement => {
        const m = document.createElement('meta');
        m.name = 'viewport';
        head.appendChild(m);
        this.createdViewportMeta = true;
        return m;
      })();

    this.viewportMeta = meta;
    this.prevViewportContent = meta.content ?? '';
    meta.content = this.withZoomLocked(this.prevViewportContent);
  }

  private unlockViewportZoom(): void {
    if (!this.viewportMeta) return;
    if (this.createdViewportMeta) {
      this.viewportMeta.remove();
    } else if (this.prevViewportContent !== null) {
      this.viewportMeta.content = this.prevViewportContent;
    }
    this.viewportMeta = null;
    this.prevViewportContent = null;
    this.createdViewportMeta = false;
  }

  private withZoomLocked(content: string): string {
    const cleaned = content
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((p) => !/^user-scalable\s*=/.test(p))
      .filter((p) => !/^maximum-scale\s*=/.test(p))
      .filter((p) => !/^minimum-scale\s*=/.test(p))
      .filter((p) => !/^initial-scale\s*=/.test(p));

    cleaned.push('width=device-width', 'initial-scale=1', 'maximum-scale=1', 'user-scalable=no');
    return cleaned.join(', ');
  }
}

