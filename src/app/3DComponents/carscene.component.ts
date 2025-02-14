import { Component, CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy } from '@angular/core';
import { injectStore, extend, NgtArgs } from 'angular-three';
import { NgtsOrbitControls } from 'angular-three-soba/controls';
import { Porche } from './3DPorche.component';

@Component({
  template: `
    <ngt-ambient-light [intensity]="15" />
    <ngt-spot-light [position]="10" [intensity]="2 * Math.PI" [angle]="0.15" [penumbra]="1" [decay]="0" />
    <ngt-point-light [position]="-10" [intensity]="0.5 * Math.PI" [decay]="0" />

    <app-porche />

    <ngts-orbit-controls [options]="{ enableZoom: true, enablePan: false }" />
   <ngt-grid-helper />
  `,

  imports: [NgtsOrbitControls, Porche],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CarScene {
  protected readonly Math = Math;
}