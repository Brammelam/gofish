import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class HomeComponent {
  playerName = localStorage.getItem('playerName') || 'Anonymous';
  activeGameId = localStorage.getItem('gameId');

  constructor(private router: Router) {}

  goToGame() {
    this.router.navigate(['/go']);
  }

  goToPlayer() {
    this.router.navigate(['/player']);
  }
}
