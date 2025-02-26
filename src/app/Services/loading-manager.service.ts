import { Injectable } from '@angular/core';
import * as THREE from 'three';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LoadingManagerService {
  private loadingManager: THREE.LoadingManager;
  public isLoading$ = new BehaviorSubject<boolean>(false);
  public progress$ = new BehaviorSubject<number>(0);

  constructor() {
    this.loadingManager = new THREE.LoadingManager();

    this.loadingManager.onStart = () => {
      console.log('Loading started');
      this.isLoading$.next(true);
      this.progress$.next(0);
    };

    this.loadingManager.onLoad = () => {
      console.log('Loading complete');
      this.isLoading$.next(false);
      this.progress$.next(100);
    };

    this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
      console.log(`Loading file: ${url} (${itemsLoaded} of ${itemsTotal})`);
      this.progress$.next((itemsLoaded/itemsTotal) * 100);
    };

    this.loadingManager.onError = (url) => {
      console.error(`Error loading ${url}`);
      this.isLoading$.next(false);
    };
  }

  getManager(): THREE.LoadingManager {
    return this.loadingManager;
  }
}
