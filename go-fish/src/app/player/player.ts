import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Socket } from 'socket.io-client';
import { SocketService } from '../services/socket';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './player.html',
  styleUrls: ['./player.css'],
})
export class PlayerComponent implements OnInit {
  socket!: Socket;
  name = '';
  activeGameId: string | null = null;

  constructor(private router: Router, private socketService: SocketService) {}

  ngOnInit() {
    // Load existing data
    this.name = localStorage.getItem('playerName') || '';
    this.activeGameId = localStorage.getItem('gameId');
  }

  saveName() {
    if (this.name.trim()) {
      console.log("Name set to: " + this.name.trim());
      localStorage.setItem('playerName', this.name.trim());
      this.socketService.emit('updateName', {
        playerId: localStorage.getItem('playerId'),
        name: this.name,
      });
    }
  }

  resumeGame() {
    if (this.activeGameId) {
      this.router.navigate(['/go'], { queryParams: { gameId: this.activeGameId } });
    }
  }

  clearData() {
    if (confirm('Are you sure you want to clear saved data?')) {
      localStorage.removeItem('playerName');
      localStorage.removeItem('gameId');
      this.name = '';
      this.activeGameId = null;
      alert('🧹 Data cleared');
    }
  }
}
