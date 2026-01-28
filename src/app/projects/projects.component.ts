import { Component, inject } from '@angular/core';
import { ProjectSectionComponent } from './components/project-section/project-section.component';
import { ProjectsService } from './services/projects.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [ProjectSectionComponent],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.css'
})
export class ProjectsComponent {
  private readonly projectsService = inject(ProjectsService);
  readonly sections = this.projectsService.getSections();
}
