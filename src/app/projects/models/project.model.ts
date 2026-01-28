export type ProjectSectionId = 'featured' | 'recent' | 'threejs';

export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  slug: string;
  title: string;
  excerpt?: string;
  coverImage: string;
  hoverImage?: string;
  description: string;
  links?: ProjectLink[];
  gallery?: string[];
}

export interface ProjectSection {
  id: ProjectSectionId;
  title: string;
  description: string;
  projectSlugs: string[];
}

export interface ProjectSectionResolved {
  id: ProjectSectionId;
  title: string;
  description: string;
  projects: Project[];
}

