import { Component, inject } from '@angular/core';
import { AnimationEvent } from '@angular/animations';
import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderRibbonComponent } from './header-ribbon.component';
import { FooterRibbonComponent } from './footer-ribbon.component';
import { Sphere } from './3DComponents/sphere.component';
import { LoadingManagerService } from './Services/loading-manager.service';
import { Observable } from 'rxjs';
import { crossFadeAnimation, PROJECT_DETAIL_CROSSFADE_MS, ROUTE_CROSSFADE_MS, ROUTE_GUTTER_SWITCH_PAUSE_MS } from './Services/route-transitions';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, CommonModule, HeaderRibbonComponent, FooterRibbonComponent, Sphere],
    templateUrl: './app.component.html',
    animations: [crossFadeAnimation],
    styleUrl: './app.component.css'
})
export class AppComponent {
  title = '3dwebsite';
  // Loading manager
  isLoading$: Observable<boolean>;
  progress$: Observable<number>;
  transitioning = false;
  private scrollSwitched = true;
  private fromScrollMode: 'viewport' | 'narrow' | null = null;
  private toScrollMode: 'viewport' | 'narrow' | null = null;
  private switchTimer: number | null = null;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(
    private loadingService: LoadingManagerService) {
      this.isLoading$ = this.loadingService.isLoading$;
      this.progress$ = this.loadingService.progress$;
    }
  route = inject(ActivatedRoute);

  prepareRoute(outlet: RouterOutlet): string {
    return (outlet?.activatedRouteData?.['animation'] as string | undefined) ?? 'root';
  }

  private scrollModeForAnimState(state: unknown): 'viewport' | 'narrow' | null {
    // Tie this to your route animation state names (data.animation).
    if (state === 'projects') return 'viewport';
    if (state === 'project-detail') return 'narrow';
    return null;
  }

  private transitionMsFor(fromState: unknown, toState: unknown): number {
    // Must match special-cases in `crossFadeAnimation`.
    if (
      (fromState === 'projects' && toState === 'project-detail') ||
      (fromState === 'project-detail' && toState === 'projects')
    ) {
      return PROJECT_DETAIL_CROSSFADE_MS;
    }
    return ROUTE_CROSSFADE_MS;
  }

  onRouteAnimStart(ev: AnimationEvent): void {
    this.transitioning = true;
    this.scrollSwitched = false;
    this.fromScrollMode = this.scrollModeForAnimState(ev.fromState);
    this.toScrollMode = this.scrollModeForAnimState(ev.toState);

    const leaveMs = this.transitionMsFor(ev.fromState, ev.toState);
    // Switch scroll mode/gutter *after* leave finishes and *before* enter begins.
    // During SSR/prerender there is no `window`, but Angular still runs animation hooks.
    if (!this.isBrowser) return;

    if (this.switchTimer !== null) window.clearTimeout(this.switchTimer);
    this.switchTimer = window.setTimeout(() => {
      // This moment aligns with the "pause" between leave and enter (see ROUTE_GUTTER_SWITCH_PAUSE_MS).
      // Safe place to change scroll gutters AND do any scroll resets without visible jumping.
      this.scrollSwitched = true;

      // If we're entering project detail from a scrolled Projects list, reset scroll to top
      // during the pause window so the Back button is visible and no jump is seen.
      if (ev.toState === 'project-detail') {
        const viewport = document.querySelector('.route-viewport') as HTMLElement | null;
        viewport?.scrollTo({ top: 0, left: 0 });
        const right = document.querySelector('.right') as HTMLElement | null;
        right?.scrollTo({ top: 0, left: 0 });
      }
    }, leaveMs);
  }

  onRouteAnimDone(): void {
    this.transitioning = false;
    this.scrollSwitched = true;
    if (!this.isBrowser) return;
    if (this.switchTimer !== null) window.clearTimeout(this.switchTimer);
    this.switchTimer = null;
  }

  scrollMode(outlet: RouterOutlet): 'viewport' | 'narrow' | null {
    if (this.transitioning) {
      // During transitions, keep the leaving route's scroll mode until leave completes,
      // then flip to the entering route's scroll mode during the pause window.
      return (this.scrollSwitched ? this.toScrollMode : this.fromScrollMode) ?? null;
    }
    const mode = outlet?.activatedRouteData?.['scrollMode'] as 'viewport' | 'narrow' | undefined;
    if (mode === 'viewport' || mode === 'narrow') return mode;
    return outlet?.activatedRouteData?.['scroll'] === true ? 'viewport' : null;
  }

  isInteractive(outlet: RouterOutlet): boolean {
    return this.scrollMode(outlet) !== null || outlet?.activatedRouteData?.['interactive'] === true;
  }

  isHeaderHidden(outlet: RouterOutlet): boolean {
    return outlet?.activatedRouteData?.['hideHeader'] === true;
  }
}
