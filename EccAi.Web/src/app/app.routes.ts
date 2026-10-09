import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./pages/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'devices',
        loadComponent: () => import('./pages/devices').then((m) => m.Devices),
      },
      {
        path: 'devices/:id',
        loadComponent: () => import('./pages/device-detail').then((m) => m.DeviceDetail),
      },
      {
        path: 'rules',
        loadComponent: () => import('./pages/rules').then((m) => m.Rules),
      },
      {
        path: 'alerts',
        loadComponent: () => import('./pages/alerts').then((m) => m.Alerts),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
