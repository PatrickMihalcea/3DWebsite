import { animate, query, style, transition, trigger } from "@angular/animations";

// Keep this export here (instead of a separate timings file) so route animation timing
// and any dependent cleanup logic can share one source of truth.
export const ROUTE_CROSSFADE_MS = 1800;
export const PROJECT_DETAIL_CROSSFADE_MS = 750;
// Small gap to allow layout/scroll-gutter changes between leave and enter.
export const ROUTE_GUTTER_SWITCH_PAUSE_MS = 40;

function sequentialFade(ms: number) {
  return [
    // On first load, or certain fast navigations, :enter or :leave may not exist.
    // Mark queries optional so animations never hard-crash the app.
    query(':enter, :leave', style({ position: 'absolute', inset: 0, width: '100%', height: '100%' }), { optional: true }),
    // Ensure the leaving view is above the entering view so WebGL/canvas fades correctly.
    query(':enter', style({ opacity: 0, zIndex: 1 }), { optional: true }),
    query(':leave', style({ opacity: 1, zIndex: 2 }), { optional: true }),
    // Sequential: fade OUT the old route first, THEN fade IN the new route.
    query(':leave', animate(`${ms}ms ease-in-out`, style({ opacity: 0 })), { optional: true }),
    // Wait briefly before entering so the app can switch scroll-gutter/layout after leave completes.
    query(':enter', animate(`${ms}ms ${ROUTE_GUTTER_SWITCH_PAUSE_MS}ms ease-in-out`, style({ opacity: 1 })), { optional: true }),
  ];
}

export const crossFadeAnimation = trigger('crossFadeAnimation', [
  // Special-case: Projects list <-> Project detail
  transition('projects <=> project-detail', sequentialFade(PROJECT_DETAIL_CROSSFADE_MS)),

  // Default fallback for everything else
  transition('* => *', sequentialFade(ROUTE_CROSSFADE_MS)),
]);
