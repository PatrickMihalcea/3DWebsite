import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { ProjectsComponent } from './projects/projects.component';
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  { path: 'home', component: HomeComponent, data: { animation: 'home' } },
  { path: 'projects', component: ProjectsComponent, data: { animation: 'projects' } },
  { path: '**', redirectTo: 'home' },
];
