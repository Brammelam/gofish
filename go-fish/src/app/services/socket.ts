import { Injectable, NgZone } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket!: Socket;
  public connected = false;

  constructor(private ngZone: NgZone) {
    window.addEventListener('beforeunload', () => {
      this.disconnect();
    });
  }

  connect(): void {
    if (this.socket && this.connected) return;

    if (!this.socket) {
      this.socket = io(environment.backendUrl, {
        transports: ['websocket'],
        autoConnect: false,
      });

      console.log('[SocketService] Connected:', this.socket.id);

      this.socket.on('connect', () => {
        this.ngZone.run(() => {
          this.connected = true;
          console.log('[SocketService] Connected:', this.socket?.id);
        });
      });

      this.socket.on('disconnect', () => {
        this.ngZone.run(() => {
          this.connected = false;
          console.log('[SocketService] Disconnected');
        });
      });
    }
    if (!this.socket.connected) {
      this.socket.connect();
    }
  }

  disconnect(): void {
    if (this.socket?.connected) {
      console.log('[SocketService] Disconnecting socket...');
      this.socket.disconnect();
      this.connected = false;
    }
  }

  emit(event: string, data?: any): void {
    if (!this.socket) {
      console.warn(`[SocketService] emit() called before connect(): ${event}`);
      this.connect();
    }

    this.socket?.emit(event, data);
  }

  on<T>(event: string): Observable<T> {
    return new Observable((subscriber) => {
      this.socket?.on(event, (data: T) => {
        this.ngZone.run(() => subscriber.next(data));
      });

      return () => {
        this.socket?.off(event);
      };
    });
  }

  onOnce<T>(event: string): Observable<T> {
    return new Observable((subscriber) => {
      const handler = (data: T) => {
        this.ngZone.run(() => {
          subscriber.next(data);
          subscriber.complete();
        });
        this.socket?.off(event, handler);
      };

      this.socket?.on(event, handler);
      return () => this.socket?.off(event, handler);
    });
  }
}
