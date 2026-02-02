import { ProjectSection } from '../models/project.model';

export const PROJECT_SECTIONS: ProjectSection[] = [
  {
    id: 'personal',
    title: 'Personal',
    description: 'A few highlight projects that I built for myself.',
    projectSlugs: ['AI-Social-Media-Content-Engine', ]
  },
  {
    id: 'work',
    title: 'Work Projects',
    description: 'Latest work for clients.',
    projectSlugs: ['AI-Knowledge-Base-Query-Tool',]
  },
  // {
  //   id: 'experiments',
  //   title: 'ThreeJS explorations',
  //   description: 'Interactive 3D experiments and visual prototypes.',
  //   projectSlugs: ['example-project']
  // }
];

