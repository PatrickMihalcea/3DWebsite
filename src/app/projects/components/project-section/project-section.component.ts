import { Component, Input } from '@angular/core';
import { Project } from '../../models/project.model';
import { ProjectTileComponent } from '../project-tile/project-tile.component';

@Component({
  selector: 'app-project-section',
  standalone: true,
  imports: [ProjectTileComponent],
  templateUrl: './project-section.component.html',
  styleUrl: './project-section.component.css'
})
export class ProjectSectionComponent {
  @Input({ required: true }) title!: string;
  @Input({ required: true }) description!: string;
  @Input({ required: true }) projects!: Project[];
}

