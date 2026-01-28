import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HeaderRibbonComponent } from './header-ribbon.component';
import { FooterRibbonComponent } from './footer-ribbon.component';
import { Sphere } from './3DComponents/sphere.component';
import { LoadingManagerService } from './Services/loading-manager.service';
import { Observable } from 'rxjs';
import { crossFadeAnimation } from './Services/route-transitions';

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

  constructor(
    private loadingService: LoadingManagerService) {
      this.isLoading$ = this.loadingService.isLoading$;
      this.progress$ = this.loadingService.progress$;
    }
  route = inject(ActivatedRoute);

  prepareRoute(outlet: RouterOutlet): string {
    return (outlet?.activatedRouteData?.['animation'] as string | undefined) ?? 'root';
  }

  scrollMode(outlet: RouterOutlet): 'viewport' | 'narrow' | null {
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
