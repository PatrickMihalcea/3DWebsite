import { ProjectSection } from '../models/project.model';

export const PROJECT_SECTIONS: ProjectSection[] = [
  {
    id: 'featured',
    title: 'Featured',
    description: 'A few highlight projects — curated and kept up to date.',
    projectSlugs: ['example-project']
  },
  {
    id: 'recent',
    title: 'Recent',
    description: 'Latest work and experiments as they ship.',
    projectSlugs: ['example-project','example-project']
  },
  {
    id: 'threejs',
    title: 'ThreeJS explorations',
    description: 'Interactive 3D experiments and visual prototypes.',
    projectSlugs: ['example-project']
  }
];

