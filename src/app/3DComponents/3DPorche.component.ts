import { Component, CUSTOM_ELEMENTS_SCHEMA, ElementRef, ChangeDetectionStrategy, viewChild, signal, input,effect, computed } from '@angular/core';
import { extend, injectBeforeRender, injectLoader, NgtArgs, NgtVector3 } from 'angular-three';
import * as THREE from 'three';
import { injectGLTF } from 'angular-three-soba/loaders'


extend(THREE);

@Component({
  selector: 'app-porche',
  standalone: true,
  imports: [NgtArgs],
  template: `
    <ngt-mesh>
    @if (porchegltf(); as gltf) {
      <ngt-primitive *args="[gltf.scene]"/> 
    }
    </ngt-mesh>
  `,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Porche {
    porchegltf = injectGLTF(() => './Porche/scene.gltf')
}
