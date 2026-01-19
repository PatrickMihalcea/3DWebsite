import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-right-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel">
      <div class="panel__inner">
        <div class="panel__kicker">
        Hi, I'm Patrick Mihalcea, a <b>fullstack software developer</b> with 3 years of experience who is <b>passionate about mastering my craft</b>.
        <br><br>
        I crave challenging projects that push me to explore new technologies and grow as a developer.
        I care deeply about doing things properly, from design decisions to maintainability long after launch.
        <br><br>
        If you have a project that you think I would be a good fit for, please feel free to reach out to me.
        Thank you for visiting my portfolio.
        </div>
      </div>
    </section>
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }

    .panel {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent;
    }

    .panel__inner {
      width: min(560px, 92%);
      padding: 24px;
      // border-radius: 18px;
      // background: rgba(255, 255, 255, 0.18);
      // backdrop-filter: blur(10px);
      // -webkit-backdrop-filter: blur(10px);
      // border: 1px solid rgba(0, 0, 0, 0.06);
      // color: rgba(15, 15, 18, 0.9);
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
    }

    .panel__kicker {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.14em;
      // text-transform: uppercase;
      opacity: 0.75;
      -webkit-user-select: none;
      -ms-user-select: none;
      user-select: none;
    }

    .panel__title {
      margin-top: 10px;
      font-weight: 800;
      font-size: 28px;
      line-height: 1.05;
      letter-spacing: 0.02em;
    }

    .panel__body {
      margin-top: 12px;
      font-size: 14px;
      line-height: 1.45;
      opacity: 0.85;
    }
  `],
})
export class RightPanelComponent {}

