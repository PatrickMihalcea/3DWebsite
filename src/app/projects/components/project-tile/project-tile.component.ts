import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Project } from '../../models/project.model';

@Component({
  selector: 'app-project-tile',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './project-tile.component.html',
  styleUrl: './project-tile.component.css'
})
export class ProjectTileComponent {
  @Input({ required: true }) project!: Project;
}

