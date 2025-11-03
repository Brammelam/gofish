import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SocketService } from './services/socket';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App implements OnInit {
  playerName: string | null = null;

  constructor(private cdr: ChangeDetectorRef, private socketService: SocketService) {}

  ngOnInit() {
    this.socketService.connect();
    this.playerName = localStorage.getItem('playerName');
    window.addEventListener('storage', (event) => {
      if (event.key === 'playerName') {
        this.playerName = event.newValue;
        this.cdr.markForCheck();
      }
    });
  }
}
