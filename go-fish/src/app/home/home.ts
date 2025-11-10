import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SocketService } from '../services/socket';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class HomeComponent implements OnInit {
  playerName = localStorage.getItem('playerName') || 'Anonymous';
  activeGameId = localStorage.getItem('gameId');

  constructor(
    private router: Router,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    this.socketService.connect();
    
    const playerId = localStorage.getItem('playerId');
    if (playerId) {
      this.socketService.registerPlayer(playerId);
    }
  }

  goToGame() {
    this.router.navigate(['/go']);
  }

  goToPlayer() {
    this.router.navigate(['/player']);
  }
}
