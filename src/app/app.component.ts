import { Scene } from './3DComponents/scene.component';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NgtCanvas, extend } from 'angular-three';

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
  title = '3dwebsite';
}