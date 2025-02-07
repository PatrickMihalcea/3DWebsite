import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ThreeJsSceneComponent } from './three-js-scene.component';

describe('ThreeJsSceneComponent', () => {
  let component: ThreeJsSceneComponent;
  let fixture: ComponentFixture<ThreeJsSceneComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ThreeJsSceneComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ThreeJsSceneComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
