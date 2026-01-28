import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { ProjectsComponent } from './projects/projects.component';
import { ProjectDetailComponent } from './projects/components/project-detail/project-detail.component';
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: HomeComponent, data: { animation: 'home' } },
  { path: 'projects', component: ProjectsComponent, data: { animation: 'projects', scrollMode: 'viewport' } },
  // Keep the same animation key as `/projects` so the 3D background (UFO preset) stays consistent.
  { path: 'projects/:slug', component: ProjectDetailComponent, data: { animation: 'projects', hideHeader: true, scrollMode: 'narrow' } },
  { path: '**', redirectTo: 'home' },
];
