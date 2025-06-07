import { Component } from '@angular/core';
import { GeminiService } from '../../services/gemini.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-gemini-demo',
  imports: [FormsModule,CommonModule],
  standalone:true,
  templateUrl: './gemini-demo.component.html',
  styleUrl: './gemini-demo.component.scss',
})
export class GeminiDemoComponent {
  prompt: string = '';
  response: string = '';
  loading: boolean = false;
  error: string = '';

  constructor(private geminiService: GeminiService) {}

  generateResponse() {
    if (!this.prompt.trim()) {
      this.error = '請輸入提示文字';
      return;
    }

    this.loading = true;
    this.error = '';
    this.response = '';

    this.geminiService.generateText(this.prompt).subscribe({
      next: (result) => {
        this.response = result;
        this.loading = false;
      },
      error: (err) => {
        this.error = err.message;
        this.loading = false;
      }
    });
  }
}
