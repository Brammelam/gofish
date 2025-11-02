import { Component, OnInit, NgZone, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { throwError } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

interface Card {
  code: string;
  image: string;
  value: string;
  suit: string;
}

@Component({
  selector: 'app-go-fish',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './go-fish.component.html',
  styleUrls: ['./go-fish.component.css'],
})
export class GoFishComponent implements OnInit, OnDestroy {
  socket!: Socket;
  gameId: string | null = null;
  playerId: string | null = null;
  players: Record<string, { hand: Card[]; sets: any[] }> = {};
  messages: string[] = [];
  remaining = 52;
  turn = '';
  selectedRank = '';
  showCelebration = false;
  celebrationText = '';
  joined = false;

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    let storedId = localStorage.getItem('playerId');
    if (!storedId) {
      storedId = crypto.randomUUID();
      localStorage.setItem('playerId', storedId);
    }
    this.playerId = storedId;
    this.socket = io('http://localhost:4000');

    this.socket.on('connect', () => {
      const savedGameId = localStorage.getItem('gameId');
      const playerId = localStorage.getItem('playerId');

      if (savedGameId && playerId) {
        this.gameId = savedGameId;
        console.log(`Rejoining existing game: ${this.gameId}`);
        this.socket.emit('getState', { gameId: this.gameId, playerId: this.playerId });
        this.joined = true;
      } else {
        console.log('No saved game found.');
      }

      // handle invite links separately
      this.route.queryParams.subscribe((params) => {
        const urlGameId = params['gameId'];
        if (urlGameId && !this.joined) {
          this.gameId = urlGameId;
          console.log(`Joining game from invite: ${this.gameId}`);
          this.joinGame();
        }
      });
    });

    this.socket.on('gameCreated', (data) => {
      this.ngZone.run(() => {
        if (!data) {
          console.warn('[gameCreated] No data received');
          return;
        }

        this.gameId = data.id || data.gameId;
        this.players = data.state.players;
        this.turn = data.state.turn;

        this.joined = true;

        localStorage.setItem('gameId', this.gameId!);
        console.log('Game created with ID: ' + this.gameId);
        this.cdr.markForCheck();
      });
    });

    this.socket.on('stateUpdate', (state) => {
      this.ngZone.run(() => {
        if (!state || !state.players) {
          console.warn('Invalid state received:', state);
          return;
        }

        // Keep track of previous set count
        const prevSets = this.players[this.playerId ?? '']?.sets?.length ?? 0;
        const newSets = state.players[this.playerId ?? '']?.sets?.length ?? 0;

        this.players = state.players;
        this.turn = state.turn;
        this.remaining = state.remaining ?? 0;
        if (!this.gameId && state.id) this.gameId = state.id;
        this.joined = true;

        // 🎉 Detect when player completes a new set
        if (newSets > prevSets) {
          const newSet = this.players[this.playerId!].sets[newSets - 1];
          const rank = newSet?.[0]?.value ?? 'Unknown';
          this.showSetCelebration(rank);
        }

        this.cdr.markForCheck();
      });
    });

    this.socket.on('message', (msg) => {
      this.ngZone.run(() => {
        alert(msg.text || 'Message from server');
      });
    });

    this.socket.on('gameMessage', (msg) => {
      this.ngZone.run(() => {
        this.messages.push(msg.text);
        if (this.messages.length > 3) this.messages.shift(); // keep last 3 messages
        this.cdr.markForCheck();
      });
    });

    const savedGameId = localStorage.getItem('gameId');
    const playerId = localStorage.getItem('playerId');
    if (savedGameId && playerId) {
      this.socket.emit('getState', { gameId: savedGameId, playerId });

      this.joined = true;
      this.cdr.markForCheck();
    }
  }

  ngOnDestroy() {
    this.socket?.disconnect();
  }

  get hasJoined() {
    return this.joined === true;
  }

  gameStarted(): boolean {
    return Object.keys(this.players).length === 2 && !!this.turn;
  }

  createGame() {
    if (!this.playerId) {
      // Generate if somehow missing
      this.playerId = crypto.randomUUID();
      localStorage.setItem('playerId', this.playerId);
    }
    this.socket.emit('createGame', this.playerId);
    console.log('Creating game...');
  }

  joinGame() {
    console.log('Attempting to join game on gameId: ' + this.gameId);
    if (!this.gameId) return;
    console.log('Joining game');
    this.socket.emit('joinGame', { gameId: this.gameId, playerId: this.playerId });
    localStorage.setItem('gameId', this.gameId);
    this.joined = true;
  }

  leaveGame() {
    localStorage.removeItem('gameId');
    console.log(`Leaving game ${this.gameId}`);
    this.socket.emit('leaveGame', { gameId: this.gameId, playerId: this.playerId });

    this.joined = false;
    this.players = {};
    this.turn = '';
    this.selectedRank = '';

    this.cdr.markForCheck();
  }

  onCardClick(card: Card) {
    if (!this.isMyTurn()) {
      console.log('Not your turn!');
      return;
    }

    const rank = card.value.toUpperCase();
    const validRanks = [
      'ACE',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
      '8',
      '9',
      '10',
      'JACK',
      'QUEEN',
      'KING',
    ];

    if (!validRanks.includes(rank)) {
      console.warn('Invalid rank:', rank);
      return;
    }

    const opponent = Object.keys(this.players).find((id) => id !== this.playerId);
    if (!opponent) {
      console.warn('No opponent found');
      return;
    }

    console.log(`Asking ${opponent} for ${rank}s`);
    this.messages.push(`You asked for ${rank}s...`);
    this.socket.emit('ask', {
      gameId: this.gameId,
      from: this.playerId,
      to: opponent,
      rank,
    });
  }

  showSetCelebration(rank: string) {
    const formatted = rank.charAt(0).toUpperCase() + rank.slice(1).toLowerCase();
    const message = `🎉 Set complete! You collected all ${formatted}s!`;
    this.messages.push(message);

    // Trigger visual animation
    this.showCelebration = true;
    this.celebrationText = message;

    setTimeout(() => {
      this.showCelebration = false;
      this.celebrationText = '';
    }, 3000);
  }

  hand(): Card[] {
    return this.players[this.playerId ?? '']?.hand ?? [];
  }

  opponentId(): string {
    return Object.keys(this.players).find((id) => id !== this.playerId)!;
  }

  isMyTurn() {
    return this.turn === this.playerId;
  }

  get gameLink() {
    return `${window.location.origin}?gameId=${this.gameId}`;
  }

  copyLink() {
    if (!this.gameLink) return;
    navigator.clipboard.writeText(this.gameLink);
    alert('Game link copied to clipboard!');
  }
}
