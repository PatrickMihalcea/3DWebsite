import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

/**
 * One-time "intro gate" used to keep UI hidden on a full reload
 * until the UFO intro animation has finished.
 */
@Injectable({ providedIn: 'root' })
export class IntroGateService {
  private readonly _ready = new BehaviorSubject<boolean>(false);
  readonly ready$: Observable<boolean> = this._ready.asObservable();

  private started = false;
  private finished = false;
  private timerId: number | null = null;

  /**
   * Start the gate timer (idempotent). When it completes, the gate opens.
   */
  start(durationMs: number): void {
    if (this.started || this.finished) return;
    this.started = true;
    this._ready.next(false);

    const ms = Math.max(0, Math.floor(durationMs));
    // Use globalThis so SSR doesn't require `window`.
    this.timerId = (globalThis as any).setTimeout?.(() => this.finish(), ms) ?? null;
  }

  /**
   * Open the gate immediately (idempotent).
   */
  finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.timerId !== null) {
      (globalThis as any).clearTimeout?.(this.timerId);
      this.timerId = null;
    }
    this._ready.next(true);
  }
}

