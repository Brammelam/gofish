import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GoFishComponent } from './go-fish/go-fish.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [FormsModule, GoFishComponent],
  templateUrl: './app.html',
  styleUrls: ['./app.css'],
})
export class App {
}
