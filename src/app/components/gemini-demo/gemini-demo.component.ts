import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { GeminiService } from '../../services/gemini.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BehaviorSubject } from 'rxjs';

@Component({
  selector: 'app-gemini-demo',
  imports: [FormsModule,CommonModule],
  standalone:true,
  templateUrl: './gemini-demo.component.html',
  styleUrl: './gemini-demo.component.scss',
})


export class GeminiDemoComponent implements OnInit, AfterViewInit {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  messages: ChatMessage[] = [];
  userInput = '';
  isLoading = false;
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);

  constructor(private geminiService: GeminiService) {}

  ngOnInit() {
    // 從 localStorage 載入對話歷史
    const savedMessages = localStorage.getItem('chatHistory');
    if (savedMessages) {
      this.messages = JSON.parse(savedMessages);
      this.messagesSubject.next(this.messages);
    }

    // 每 10 條訊息或每 5 分鐘檢查並精簡
    this.messagesSubject.subscribe(messages => {
      if (messages.length >= 10) {
        this.optimizeHistory();
      }
    });

    setInterval(() => this.optimizeHistory(), 5 * 60 * 1000);
  }

  ngAfterViewInit() {
    this.scrollToBottom();
  }

  async sendMessage() {
    if (!this.userInput.trim()) return;

    this.isLoading = true;

    const userMessage: ChatMessage = {
      text: this.userInput,
      date: new Date(),
      reply: true,
      user: { name: '您' }
    };

    // 先保存使用者輸入
    const currentInput = this.userInput;

    // 清空輸入欄位
    this.userInput = '';

    this.messages.push(userMessage);
    this.saveToLocalStorage();
    this.scrollToBottom();

    try {
      // 使用保存的輸入，但不包含剛剛加入的使用者訊息
      const historyWithoutCurrent = this.messages.slice(0, -1);
      const botReply = await this.geminiService.generate(currentInput, historyWithoutCurrent);

      const botMessage: ChatMessage = {
        text: botReply,
        date: new Date(),
        reply: false,
        user: { name: '教養專家' }
      };

      this.messages.push(botMessage);
      this.saveToLocalStorage();
      this.messagesSubject.next(this.messages);
    } catch (error) {
      console.error('Gemini API 錯誤:', error);
      this.messages.push({
        text: '抱歉，發生錯誤，請稍後再試。',
        date: new Date(),
        reply: false,
        user: { name: '教養專家' }
      });
    } finally {
      this.isLoading = false;
      this.scrollToBottom();
    }
  }
  private async optimizeHistory() {
    if (this.isLoading || this.messages.length < 10) return;

    this.isLoading = true;
    try {
      const historyText = this.messages.map(m => `${m.user.name}: ${m.text}`).join('\n');
      const prompt = `以下是對話歷史，請整理並精簡為重點摘要（不超過 500 字），保留關鍵教養建議和問題，刪除重複或不重要的內容：

${historyText}

整理後的摘要請以條列式呈現，確保清晰且有邏輯。`;
      const summary = await this.geminiService.generate(prompt, []);

      // 清空舊歷史，存入摘要作為新歷史
      this.messages = [{
        text: `對話摘要：\n${summary}`,
        date: new Date(),
        reply: false,
        user: { name: '教養專家' }
      }];
      this.saveToLocalStorage();
      this.messagesSubject.next(this.messages);
    } catch (error) {
      console.error('精簡歷史失敗:', error);
    } finally {
      this.isLoading = false;
      this.scrollToBottom();
    }
  }

  private saveToLocalStorage() {
    localStorage.setItem('chatHistory', JSON.stringify(this.messages));
  }

  private scrollToBottom() {
    setTimeout(() => {
      this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
    }, 0);
  }
}

interface ChatMessage {
  text: string;
  date: Date;
  reply: boolean;
  user: { name: string; avatar?: string };
}
