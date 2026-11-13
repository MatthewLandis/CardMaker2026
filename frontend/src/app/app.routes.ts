import { inject } from '@angular/core';
import { Router, Routes, type CanActivateFn } from '@angular/router';
import { AuthService } from './auth/auth.service';

/** Sends logged-out visitors to the login page, then back to where they were going afterwards. */
const requireLogin: CanActivateFn = (_route, state) =>
  inject(AuthService).loggedIn() || inject(Router).createUrlTree(['/login'], { queryParams: { next: state.url } });

export const routes: Routes = [
  { path: '', loadComponent: () => import('./editor/editor').then(m => m.Editor), title: 'CardMaker' },
  {
    path: 'edit/:id',
    loadComponent: () => import('./editor/editor').then(m => m.Editor),
    canActivate: [requireLogin],
    title: 'Edit card · CardMaker',
  },
  {
    path: 'cards',
    loadComponent: () => import('./catalog/catalog').then(m => m.Catalog),
    canActivate: [requireLogin],
    title: 'My cards · CardMaker',
  },
  { path: 'login', loadComponent: () => import('./auth/login').then(m => m.Login), title: 'Log in · CardMaker' },
  { path: '**', redirectTo: '' },
];
