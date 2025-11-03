import { Routes } from '@angular/router';
import { GoFishComponent } from './go-fish/go-fish.component';
import { PlayerComponent } from './player/player';
import { HomeComponent } from './home/home';

export const routes: Routes = [
    { path: 'home', component: HomeComponent },
    { path: 'player', component: PlayerComponent },
    { path: 'go', component: GoFishComponent },
    { path: '**', redirectTo: 'home' }
];
