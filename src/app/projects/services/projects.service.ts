import { Injectable } from '@angular/core';
import { PROJECTS } from '../data/projects.data';
import { PROJECT_SECTIONS } from '../data/project-sections.data';
import { Project, ProjectSectionResolved } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly projectsBySlug = new Map<string, Project>(
    PROJECTS.map((p) => [p.slug, p] as const)
  );

  getProject(slug: string): Project | undefined {
    return this.projectsBySlug.get(slug);
  }

  getSections(): ProjectSectionResolved[] {
    return PROJECT_SECTIONS.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      projects: s.projectSlugs
        .map((slug) => this.projectsBySlug.get(slug))
        .filter((p): p is Project => Boolean(p))
    }));
  }
}

