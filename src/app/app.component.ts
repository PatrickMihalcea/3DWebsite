import { Scene } from './3DComponents/scene.component';
import { CarScene } from './3DComponents/carscene.component';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgtCanvas, extend } from 'angular-three';
import { NgtsLoader } from 'angular-three-soba/loaders';
import { Sphere } from './3DComponents/sphere.component';
import { LoadingManagerService } from './Services/loading-manager.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { Galaxy } from './3DComponents/galaxy.component';
import * as THREE from 'three';


extend(THREE);

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, NgtCanvas, NgtsLoader, Sphere, Galaxy, CommonModule],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent {  
  protected scene = Scene;
  protected carScene = CarScene;
  title = '3dwebsite';
  isLoading$: Observable<boolean>;
  progress$: Observable<number>;

  constructor(private loadingService: LoadingManagerService) {
    this.isLoading$ = this.loadingService.isLoading$;
    this.progress$ = this.loadingService.progress$;
  }
}
