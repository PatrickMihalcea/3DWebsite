import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { ProjectsComponent } from './projects/projects.component';
import { ProjectDetailComponent } from './projects/components/project-detail/project-detail.component';
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: HomeComponent, data: { animation: 'home' } },
  {
    path: 'resume',
    loadComponent: () => import('./resume/resume.component').then((m) => m.ResumeComponent),
    // No outer scrolling; the PDF viewer scrolls internally.
    // `interactive: true` is required because the app disables pointer-events by default
    // unless a route is marked interactive or scrolling.
    data: { animation: 'resume', spherePreset: 'home', interactive: true }
  },
  {
    path: 'projects',
    component: ProjectsComponent,
    data: { animation: 'projects', spherePreset: 'projects', scrollMode: 'viewport' }
  },
  // Keep the same Sphere preset as `/projects` so the 3D background (UFO preset) stays consistent,
  // but use a distinct animation key so the UI still transitions between list <-> detail.
  {
    path: 'projects/:slug',
    component: ProjectDetailComponent,
    data: { animation: 'project-detail', spherePreset: 'projects', hideHeader: true, scrollMode: 'narrow' }
  },
  { path: '**', redirectTo: 'home' },
];
