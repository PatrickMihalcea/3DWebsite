import { Component } from '@angular/core';
import { HeroSceneComponent } from '../3DComponents/hero-scene.component';
import { RightPanelComponent } from './right-panel.component';
import { LoadingManagerService } from '../Services/loading-manager.service';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [HeroSceneComponent, RightPanelComponent, CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css'
})
export class HomeComponent {

}
