import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Socket } from 'socket.io-client';
import { SocketService } from '../services/socket';
import { Router, RouterLink } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

@Component({
  selector: 'app-player',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './player.html',
  styleUrls: ['./player.css'],
})
export class PlayerComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  socket!: Socket;
  name = '';
  playerId: string | null = null;
  activeGameId: string | null = null;
  playerHistory: any[] = [];

  constructor(
    private router: Router,
    private socketService: SocketService,
    private cdr: ChangeDetectorRef
  ) {}

ngOnInit() {
  this.name = localStorage.getItem('playerName') || '';
  this.playerId = localStorage.getItem('playerId');
  this.activeGameId = localStorage.getItem('gameId');

  this.socketService.connect();

  if (this.playerId) {
    this.socketService.registerPlayer(this.playerId);
  }

  this.socketService.on<any[]>('historyResponse')
  .pipe(takeUntil(this.destroy$))
  .subscribe((data) => {
    this.playerHistory = data.sort((a, b) => {
      const aTime = new Date(a.timestamp || 0).getTime();
      const bTime = new Date(b.timestamp || 0).getTime();
      return bTime - aTime;
    });
    this.cdr.markForCheck();
  });

  if (this.socketService.connected && this.playerId) {
    this.loadHistory();
  } else {
    this.socketService
        .onOnce('connect')
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => {
          if (this.playerId) {
            this.socketService.registerPlayer(this.playerId);
            this.loadHistory();
          }
        });
  }
}


  loadHistory() {
    if (this.playerId) {
      this.socketService.emit('historyRequest', { playerId: this.playerId });
    }
  }

  saveName() {
    if (this.name.trim()) {
      localStorage.setItem('playerName', this.name.trim());
      this.socketService.emit('updateName', {
        playerId: localStorage.getItem('playerId'),
        name: this.name,
      });
      alert('Name updated!');
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

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
