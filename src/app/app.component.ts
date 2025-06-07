import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { GeminiDemoComponent } from './components/gemini-demo/gemini-demo.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet,GeminiDemoComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'gemini-chat-app';
}
