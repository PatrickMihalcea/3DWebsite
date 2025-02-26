import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { config } from './app/app.config.server';

global['cancelAnimationFrame'] = function(id) {
    clearTimeout(id);
  };
  
const bootstrap = () => bootstrapApplication(AppComponent, config);

export default bootstrap;
