import { Component } from '@angular/core';
import { Sphere } from '../3DComponents/sphere.component';
import { HeroSceneComponent } from '../3DComponents/hero-scene.component';
import { RightPanelComponent } from './right-panel.component';
import { LoadingManagerService } from '../Services/loading-manager.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [Sphere, HeroSceneComponent, RightPanelComponent, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {
  // Loading manager
  isLoading$: Observable<boolean>;
  progress$: Observable<number>;

  constructor(private loadingService: LoadingManagerService) {
    this.isLoading$ = this.loadingService.isLoading$;
    this.progress$ = this.loadingService.progress$;
  }



}
