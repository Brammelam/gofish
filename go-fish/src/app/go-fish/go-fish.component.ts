import { Component, OnInit, NgZone, ChangeDetectorRef, OnDestroy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { SocketService } from '../services/socket';

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
export class GoFishComponent implements OnInit {
  gameId: string | null = null;
  playerId: string | null = null;
  playerName: string | null = null;
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
    private route: ActivatedRoute,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    let storedId = localStorage.getItem('playerId');
    if (!storedId) {
      storedId = crypto.randomUUID();
      localStorage.setItem('playerId', storedId);
    }
    this.playerId = storedId;

    this.socketService.on<any>('connect').subscribe(() => {
      const savedGameId = localStorage.getItem('gameId');
      const playerId = localStorage.getItem('playerId');
      this.playerName = localStorage.getItem('playerName') || this.playerId!.substring(0, 5);

      if (savedGameId && playerId) {
        this.gameId = savedGameId;
        console.log(`Rejoining existing game: ${this.gameId}`);
        this.socketService.emit('getState', { gameId: this.gameId, playerId: this.playerId });
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

    this.socketService.on<any>('gameCreated').subscribe((data) => {
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

    this.socketService.on<any>('stateUpdate').subscribe((state) => {
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

    this.socketService.on<any>('message').subscribe((msg) => {
      this.ngZone.run(() => {
        alert(msg.text || 'Message from server');
      });
    });

    this.socketService.on<any>('gameMessage').subscribe((msg) => {
      this.ngZone.run(() => {
        this.messages.push(msg.text);
        if (this.messages.length > 3) this.messages.shift(); // keep last 3 messages
        this.cdr.markForCheck();
      });
    });

    this.rejoinIfNeeded();
  }

 private rejoinIfNeeded() {
  const savedGameId = localStorage.getItem('gameId');
  const playerId = localStorage.getItem('playerId');
  if (!savedGameId || !playerId) return;

  this.gameId = savedGameId;
  this.playerId = playerId;
  this.playerName = localStorage.getItem('playerName') || playerId.substring(0, 5);

  console.log(`[rejoinIfNeeded] Attempting to rejoin ${this.gameId}`);

  const rejoin = () => {
    console.log('[rejoinIfNeeded] Rejoining game and requesting state...');
    this.socketService.emit('getState', {
      gameId: this.gameId,
      playerId: this.playerId,
    });
    this.joined = true;
    this.cdr.markForCheck();
  };

  // Wait until socket is connected
  if (!this.socketService.connected) {
    console.log('[rejoinIfNeeded] Waiting for socket connection...');
    this.socketService.onOnce('connect').subscribe(() => {
      console.log('[rejoinIfNeeded] Socket connected (once)');
      rejoin();
    });

    // Initiate connection
    this.socketService.connect();
  } else {
    console.log('[rejoinIfNeeded] Socket already connected');
    rejoin();
  }
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
    const name = localStorage.getItem('playerName') || this.playerId.substring(0, 5);
    this.socketService.emit('createGame', { playerId: this.playerId, name });
    console.log('Creating game...');
  }

  joinGame() {
    console.log('Attempting to join game on gameId: ' + this.gameId);
    if (!this.gameId) return;
    if (!this.playerId) {
      // Generate if somehow missing
      this.playerId = crypto.randomUUID();
      localStorage.setItem('playerId', this.playerId);
    }
    const name = localStorage.getItem('playerName') || this.playerId.substring(0, 5);
    console.log('Joining game');
    this.socketService.emit('joinGame', { gameId: this.gameId, playerId: this.playerId, name });
    localStorage.setItem('gameId', this.gameId);
    this.joined = true;
  }

  leaveGame() {
    localStorage.removeItem('gameId');
    console.log(`Leaving game ${this.gameId}`);
    this.socketService.emit('leaveGame', { gameId: this.gameId, playerId: this.playerId });

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

    this.socketService.emit('ask', {
      gameId: this.gameId,
      from: this.playerId,
      to: opponent,
      rank,
    });
  }

  showSetCelebration(rank: string) {
    const formatted = rank.charAt(0).toUpperCase() + rank.slice(1).toLowerCase();
    const message = `🎉 Set complete!`;

    // Trigger visual animation
    this.showCelebration = true;
    this.celebrationText = message;

    setTimeout(() => {
      this.showCelebration = false;
      this.celebrationText = '';
      this.cdr.markForCheck();
    }, 2000);
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
