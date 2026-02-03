import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-footer-ribbon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="footer">
      <div class="footer__left">
        <span class="footer__label">Get in touch</span>
      </div>

      <nav class="footer__right" aria-label="Contact links">
        <!-- TODO: replace these hrefs with your real links -->
        <a class="footer__link" href="mailto:patrick.mihalcea@gmail.com">Email</a>
        <a class="footer__link" href="https://www.linkedin.com/in/patrickmihalcea/" target="_blank" rel="noreferrer">LinkedIn</a>
        <a class="footer__link" href="https://github.com/PatrickMihalcea" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </footer>
  `,
  styles: [`
    .footer {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 20;
      height: 56px;
      padding: 0 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;

      /* subtle glass (match header) */
      background: rgba(255, 255, 255, 0.01);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-top: 1px solid rgba(0, 0, 0, 0.06);

      color: rgba(230, 230, 230, 0.92);
      font: 600 12px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      pointer-events: auto;
    }

    .footer__left,
    .footer__right {
      white-space: nowrap;
    }

    .footer__label {
      opacity: 0.85;
    }

    .footer__right {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .footer__link {
      color: inherit;
      text-decoration: none;
      opacity: 0.85;
    }

    .footer__link:hover {
      opacity: 1;
    }

    @media (max-width: 768px) {
      .footer {
        height: 52px;
        padding: 0 20px;
        font-size: 10px;
      }
      .footer__right { gap: 14px; }
    }

    @media (max-height: 345px) {
      .footer {
        height: 30px;
      }
    }
  `],
})
export class FooterRibbonComponent {}

