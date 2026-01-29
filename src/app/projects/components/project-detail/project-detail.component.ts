import { AfterViewInit, Component, OnDestroy, computed, inject } from '@angular/core';
import { isPlatformBrowser, Location } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PLATFORM_ID } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { ProjectsService } from '../../services/projects.service';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  templateUrl: './project-detail.component.html',
  styleUrl: './project-detail.component.css'
})
export class ProjectDetailComponent implements AfterViewInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly projectsService = inject(ProjectsService);
  private readonly location = inject(Location);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private lastIsWide = false;
  private readonly resizeHandler = () => this.onResize();

  readonly slug = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('slug') ?? '')),
    { initialValue: '' }
  );

  readonly project = computed(() => this.projectsService.getProject(this.slug()));

  back(): void {
    this.location.back();
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.lastIsWide = window.innerWidth >= 981;
    window.addEventListener('resize', this.resizeHandler, { passive: true });
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    window.removeEventListener('resize', this.resizeHandler);
  }

  private onResize(): void {
    const isWide = window.innerWidth >= 981;
    // When switching from narrow (viewport scroll) -> wide (image-column scroll),
    // reset the outer scroll container so the left panel/back button isn't stuck off-screen.
    if (isWide && !this.lastIsWide) {
      const viewport = document.querySelector('.route-viewport') as HTMLElement | null;
      viewport?.scrollTo({ top: 0, left: 0 });
    }
    this.lastIsWide = isWide;
  }
}

