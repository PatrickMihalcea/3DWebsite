import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-header-ribbon',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="ribbon">
      <a class="ribbon__left" routerLink="/home">Patrick<br>Mihalcea</a>
      <nav class="ribbon__right">
        <a
          routerLink="/projects"
          routerLinkActive="is-active"
          #projectsRla="routerLinkActive"
          [attr.aria-current]="projectsRla.isActive ? 'page' : null"
        >
          Projects
        </a>
        <!-- <a href="/contact">Contact</a> -->
      </nav>
    </header>
  `,
  styles: [`
    .ribbon {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 20;
      height: 56px;
      padding: 0 40px;
      display: flex;
      align-items: center;
      justify-content: space-between;

      /* subtle glass */
      background: rgba(255, 255, 255, 0.01);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(0, 0, 0, 0.06);
      color: rgba(230, 230, 230, 0.92);
      font: 600 13px/1 ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }

    .ribbon__left,
    .ribbon__right {
      white-space: nowrap;
    }

    .ribbon__left {
      color: inherit;
      text-decoration: none;
      opacity: 0.92;
    }

    .ribbon__left:hover {
      opacity: 1;
    }

    .ribbon__right {
      display: flex;
      align-items: center;
      gap: 18px;
    }

    .ribbon__right a {
      color: inherit;
      text-decoration: none;
      opacity: 0.85;
    }

    .ribbon__right a:hover {
      opacity: 1;
    }

    .ribbon__right a.is-active {
      opacity: 1;
      text-decoration: underline;
      text-decoration-thickness: 2px;
      text-underline-offset: 6px;
      text-decoration-color: rgba(255, 255, 255, 0.45);
    }
  `],
})
export class HeaderRibbonComponent {}

