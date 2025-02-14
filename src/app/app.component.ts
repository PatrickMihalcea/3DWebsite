import { Scene } from './3DComponents/scene.component';
import { CarScene } from './3DComponents/carscene.component';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgtCanvas, extend } from 'angular-three';
import { Porche } from './3DComponents/3DPorche.component';

import * as THREE from 'three';
extend(THREE);

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, NgtCanvas],
    templateUrl: './app.component.html',
    styleUrl: './app.component.css'
})
export class AppComponent {
  protected scene = Scene;
  protected carScene = CarScene;
  title = '3dwebsite';
}