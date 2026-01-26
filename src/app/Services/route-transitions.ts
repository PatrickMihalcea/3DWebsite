import { animate, group, query, style, transition, trigger } from "@angular/animations";

// Keep this export here (instead of a separate timings file) so route animation timing
// and any dependent cleanup logic can share one source of truth.
export const ROUTE_CROSSFADE_MS = 2050;

export const crossFadeAnimation = trigger('crossFadeAnimation', [
  transition('* => *', [
    // On first load, or certain fast navigations, :enter or :leave may not exist.
    // Mark queries optional so animations never hard-crash the app.
    query(':enter, :leave', style({ position: 'absolute', inset: 0, width: '100%', height: '100%' }), { optional: true }),
    // Ensure the leaving view is above the entering view so WebGL/canvas fades correctly.
    query(':enter', style({ opacity: 0, zIndex: 1 }), { optional: true }),
    query(':leave', style({ opacity: 1, zIndex: 2 }), { optional: true }),
    group([
      query(':leave', animate(`${ROUTE_CROSSFADE_MS}ms ease-in-out`, style({ opacity: 0 })), { optional: true }),
      query(':enter', animate(`${ROUTE_CROSSFADE_MS}ms ease-in-out`, style({ opacity: 1 })), { optional: true }),
    ]),
  ])
]);
