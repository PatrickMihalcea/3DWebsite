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
        I crave challenging projects that push me to <b>explore new technologies</b> and grow as a developer.
        <b>I care deeply about doing things properly</b>, from design decisions to maintainability long after launch.
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
      color: rgba(255, 255, 255, 0.9);
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

    @media (max-width: 865px) {
      .panel__kicker {
        font-size: 10px;
      }
    }

    @media (max-height: 400px) {
      .panel__kicker {
        font-size: 10px;
      }
      .panel__inner {
        padding: 12px;
      }
    }
  `],
})
export class RightPanelComponent {}

