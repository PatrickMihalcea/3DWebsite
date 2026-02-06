import { ProjectSection } from '../models/project.model';

export const PROJECT_SECTIONS: ProjectSection[] = [
  {
    id: 'personal',
    title: 'Personal Builds',
    description: 'A few highlight projects that I built for myself.',
    projectSlugs: ['AI-Social-Media-Content-Engine', 'Machine-Learning-Traffic-System']
  },
  {
    id: 'work',
    title: 'Client Work',
    description: 'Latest work for clients.',
    projectSlugs: ['AI-Knowledge-Base-Query-Tool','AWS-Hosted-AI-App-Store-Review-Platform']
  },
  // {
  //   id: 'experiments',
  //   title: 'ThreeJS explorations',
  //   description: 'Interactive 3D experiments and visual prototypes.',
  //   projectSlugs: ['example-project']
  // }
];

