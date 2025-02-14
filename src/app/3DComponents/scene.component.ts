import { Component, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy } from '@angular/core';
import { injectStore, extend, NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { Cube } from './cube.component';

@Component({
  template: `
    <ngt-ambient-light [intensity]="0.5" />
    <ngt-spot-light [position]="10" [intensity]="0.5 * Math.PI" [angle]="0.15" [penumbra]="1" [decay]="0" />
    <ngt-point-light [position]="-10" [intensity]="0.5 * Math.PI" [decay]="0" />
    <ngt-grid-helper />
    <app-cube [position]="[1.5, 0, 0]" />
    <app-cube [position]="[-1.5, 0, 0]" />
    
    <ngts-orbit-controls [options]="{ enableZoom: false, enablePan: false }" />

<!--
    <ngt-orbit-controls *args="[camera(), glDomElement()]" />
-->
   
  `,

  imports: [Cube, NgtsOrbitControls],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Scene {
  protected readonly Math = Math;

  private store = injectStore();
  protected camera = this.store.select('camera');

  protected glDomElement = this.store.select('gl', 'domElement');
}