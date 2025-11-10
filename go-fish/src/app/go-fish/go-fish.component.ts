import { Component, OnInit, NgZone, ChangeDetectorRef, OnDestroy } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SocketService } from '../services/socket';
import { Subject, takeUntil } from 'rxjs';

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
  private destroy$ = new Subject<void>();

  gameId: string | null = null;
  playerId: string | null = null;
  playerName: string | null = null;
  players: Record<string, { hand: Card[]; sets: any[]; isAI: false }> = {};
  messages: string[] = [];
  remaining = 52;
  turn = '';
  selectedRank = '';
  showCelebration = false;
  celebrationText = '';
  joined = false;
  winner: any | null = null;

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private route: ActivatedRoute,
    private socketService: SocketService
  ) {}

  ngOnInit() {
    let storedId = localStorage.getItem('playerId');
    this.playerId = storedId;

    this.socketService.connect();

    if (this.playerId) {
      this.socketService.registerPlayer(this.playerId);
    }

    this.socketService
      .on<any>('connect')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        const savedGameId = localStorage.getItem('gameId');
        const playerId = localStorage.getItem('playerId');
        this.playerName = localStorage.getItem('playerName') || this.playerId!.substring(0, 5);

        if (playerId) {
          this.socketService.registerPlayer(playerId);
        }

        if (savedGameId && playerId) {
          this.gameId = savedGameId;
          this.socketService.emit('getState', { gameId: this.gameId, playerId: this.playerId });
          this.joined = true;
        }
      });

    this.socketService
      .on<any>('gameCreated')
      .pipe(takeUntil(this.destroy$))
      .subscribe((data) => {
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
          this.cdr.markForCheck();
        });
      });

    this.socketService
      .on<any>('stateUpdate')
      .pipe(takeUntil(this.destroy$))
      .subscribe((state) => {
        this.ngZone.run(() => {
          if (!state || !state.players) {
            console.warn('Invalid state received:', state);
            return;
          }

          const player = state.players[this.playerId ?? ''];
          if (!player) {
            console.warn('Player not found in game state:', this.playerId);
            return;
          }

          this.players = state.players;
          this.turn = state.turn;
          this.remaining = state.remaining ?? 0;
          if (!this.gameId && state.id) this.gameId = state.id;
          this.joined = true;

          // Update local player name from state
          this.playerName = player.name || this.playerId!.substring(0, 5);

          if (state.winner) {
            this.winner = state.players[state.winner];
          }

          if (this.isMyTurn() && this.winner === null) {
            this.autoDrawIfEmpty();
          }

          this.cdr.markForCheck();
        });
      });

    this.socketService
      .on<any>('setCompleted')
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ playerId, rank }) => {
        this.ngZone.run(() => {
          if (playerId === this.playerId) {
            this.showSetCelebration(rank);
          }
          this.cdr.markForCheck();
        });
      });

    this.socketService
      .on<any>('gameMessage')
      .pipe(takeUntil(this.destroy$))
      .subscribe((msg) => {
        this.ngZone.run(() => {
          this.messages.push(msg.text);
          if (this.messages.length > 3) this.messages.shift(); // keep last 3 messages
          this.cdr.markForCheck();
        });
      });

    // handle invite links separately
    this.route.queryParams.subscribe((params) => {
      const urlGameId = params['gameId'];
      if (urlGameId && !this.joined) {
        this.gameId = urlGameId;
        this.joinGame();
      }
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

    if (this.socketService.connected) {
      this.socketService.registerPlayer(playerId);
      this.socketService.emit('getState', {
        gameId: this.gameId,
        playerId: this.playerId,
      });
      this.joined = true;
    }
    
    this.cdr.markForCheck();
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
    this.socketService.emit('createGame', { playerId: this.playerId, name: name, vsAI: false });
  }

  createGameWithAI() {
    if (!this.playerId) {
      // Generate if somehow missing
      this.playerId = crypto.randomUUID();
      localStorage.setItem('playerId', this.playerId);
    }
    const name = localStorage.getItem('playerName') || this.playerId.substring(0, 5);
    this.socketService.emit('createGame', { playerId: this.playerId, name: name, vsAI: true });
  }

  joinGame() {
    if (!this.gameId) return;
    if (!this.playerId) {
      // Generate if somehow missing
      this.playerId = crypto.randomUUID();
      localStorage.setItem('playerId', this.playerId);
    }
    const name = localStorage.getItem('playerName') || this.playerId.substring(0, 5);
    this.socketService.emit('joinGame', { gameId: this.gameId, playerId: this.playerId, name });
    localStorage.setItem('gameId', this.gameId);
    this.joined = true;
    this.socketService.emit('getState', {
      gameId: this.gameId,
      playerId: this.playerId,
    });
  }

  leaveGame() {
    localStorage.removeItem('gameId');
    const name = localStorage.getItem('playerName') || this.playerId?.substring(0, 5) || 'Someone';
    this.socketService.emit('leaveGame', { gameId: this.gameId, name: name });
    this.router.navigate(['']);
  }

  onCardClick(card: Card) {
    if (!this.isMyTurn()) {
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

  autoDrawIfEmpty() {
    if (!this.isMyTurn()) return;
    const myHand = this.hand();
    if (myHand.length > 0) return;

    const opponent = this.opponentId();
    if (!opponent) return;

    this.socketService.emit('ask', {
      gameId: this.gameId,
      from: this.playerId,
      to: opponent,
      rank: 'AUTO_DRAW',
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
    if (!this.turn || !this.playerId) return false;

    const currentPlayer = this.players[this.turn];
    if (!currentPlayer) return false;

    // If playing vs AI: only allow turns when it's *not* AI's turn
    if (Object.values(this.players).some((p) => p.isAI)) {
      return !currentPlayer.isAI;
    }

    // Otherwise (human vs human)
    return this.turn === this.playerId;
  }

  get hasAI(): boolean {
    return Object.values(this.players).some((p) => (p as any).isAI);
  }

  get gameLink() {
    return `${window.location.origin}/go?gameId=${this.gameId}`;
  }

  copyLink() {
    if (!this.gameLink) return;
    navigator.clipboard.writeText(this.gameLink);
    alert('Game link copied to clipboard!');
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
