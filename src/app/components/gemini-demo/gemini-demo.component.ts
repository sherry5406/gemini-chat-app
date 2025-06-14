import { AfterViewInit, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { GeminiService } from '../../services/gemini.service';
import { MarkdownService } from '../../services/markdown.service'; // 新增
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { SafeHtml } from '@angular/platform-browser';

@Component({
  selector: 'app-gemini-demo',
  imports: [FormsModule, CommonModule],
  standalone: true,
  templateUrl: './gemini-demo.component.html',
  styleUrl: './gemini-demo.component.scss',
})
export class GeminiDemoComponent implements OnInit, AfterViewInit {
  @ViewChild('messagesContainer') messagesContainer!: ElementRef;
  messages: ChatMessage[] = [];
  userInput = '';
  isLoading = false;
  isStreaming = false;
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  currentStreamingMessageIndex = -1;

  constructor(
    private geminiService: GeminiService,
    private markdownService: MarkdownService // 新增
  ) {}

  ngOnInit() {
    // 從 localStorage 載入對話歷史
    const savedMessages = localStorage.getItem('chatHistory');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        // 重新建立 Date 物件，因為 JSON.parse 不會自動轉換日期
        this.messages = parsed.map((msg: any) => ({
          ...msg,
          date: new Date(msg.date),
          renderedText: this.markdownService.convertToHtml(msg.text) // 轉換 Markdown
        }));
        this.messagesSubject.next(this.messages);
      } catch (error) {
        console.error('載入聊天記錄失敗:', error);
        this.messages = [];
      }
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
    this.isStreaming = false;

    const userMessage: ChatMessage = {
      text: this.userInput,
      renderedText: this.markdownService.convertToHtml(this.userInput), // 轉換使用者輸入
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

    // 建立一個空的機器人訊息用於串流顯示
    const botMessage: ChatMessage = {
      text: '',
      renderedText: '', // 初始化
      date: new Date(),
      reply: false,
      user: { name: '教養專家' }
    };

    this.messages.push(botMessage);
    this.currentStreamingMessageIndex = this.messages.length - 1;
    console.log('開始串流，訊息索引:', this.currentStreamingMessageIndex);

    this.isLoading = false;
    this.isStreaming = true;

    try {
      // 使用保存的輸入，但不包含剛剛加入的使用者訊息和空機器人訊息
      const historyWithoutCurrent = this.messages.slice(0, -2);
      console.log('歷史訊息:', historyWithoutCurrent);

      const streamGenerator = this.geminiService.generateStream(currentInput, historyWithoutCurrent);
      console.log('取得串流生成器:', streamGenerator);

      let fullResponse = '';
      let chunkCount = 0;

      for await (const chunk of streamGenerator) {
        chunkCount++;
        console.log(`收到第 ${chunkCount} 個 chunk:`, chunk);
        fullResponse += chunk;

        // 更新正在串流的訊息
        if (this.currentStreamingMessageIndex >= 0 &&
            this.currentStreamingMessageIndex < this.messages.length) {
          this.messages[this.currentStreamingMessageIndex].text = fullResponse;
          this.messages[this.currentStreamingMessageIndex].renderedText = this.markdownService.convertToHtml(fullResponse); // 轉換 Markdown
          this.scrollToBottom();
        }

        // 添加一個小延遲來模擬打字效果
        await this.delay(30);
      }

      console.log('串流完成，總共收到', chunkCount, '個 chunks');
      console.log('完整回應:', fullResponse);

      // 如果沒有收到任何內容，使用備用方法
      if (!fullResponse.trim()) {
        console.log('串流沒有收到內容，使用一般生成方法');
        const fallbackResponse = await this.geminiService.generate(currentInput, historyWithoutCurrent);
        this.messages[this.currentStreamingMessageIndex].text = fallbackResponse;
        this.messages[this.currentStreamingMessageIndex].renderedText = this.markdownService.convertToHtml(fallbackResponse); // 轉換 Markdown
      }

      // 串流完成，保存最終結果
      this.saveToLocalStorage();
      this.messagesSubject.next(this.messages);

    } catch (error) {
      console.error('串流錯誤:', error);

      // 移除空的機器人訊息，添加錯誤訊息
      if (this.currentStreamingMessageIndex >= 0) {
        this.messages.splice(this.currentStreamingMessageIndex, 1);
      }

      // 嘗試使用非串流方式作為備用
      try {
        console.log('嘗試使用非串流方式...');
        const historyWithoutCurrent = this.messages.slice(0, -1);
        const fallbackResponse = await this.geminiService.generate(currentInput, historyWithoutCurrent);

        this.messages.push({
          text: fallbackResponse,
          renderedText: this.markdownService.convertToHtml(fallbackResponse), // 轉換 Markdown
          date: new Date(),
          reply: false,
          user: { name: '教養專家' }
        });
      } catch (fallbackError) {
        console.error('備用方法也失敗:', fallbackError);
        this.messages.push({
          text: '抱歉，發生錯誤，請稍後再試。',
          renderedText: this.markdownService.convertToHtml('抱歉，發生錯誤，請稍後再試。'), // 轉換 Markdown
          date: new Date(),
          reply: false,
          user: { name: '教養專家' }
        });
      }
    } finally {
      this.isStreaming = false;
      this.currentStreamingMessageIndex = -1;
      console.log('串流結束');
      this.scrollToBottom();
    }
  }

  private async optimizeHistory() {
    if (this.isLoading || this.isStreaming || this.messages.length < 10) return;

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
        renderedText: this.markdownService.convertToHtml(`對話摘要：\n${summary}`), // 轉換 Markdown
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
    try {
      // 儲存時移除 renderedText，因為它是衍生數據
      const messagesToSave = this.messages.map(({ renderedText, ...msg }) => msg);
      localStorage.setItem('chatHistory', JSON.stringify(messagesToSave));
    } catch (error) {
      console.error('保存聊天記錄失敗:', error);
    }
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer?.nativeElement) {
        this.messagesContainer.nativeElement.scrollTop = this.messagesContainer.nativeElement.scrollHeight;
      }
    }, 0);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

interface ChatMessage {
  text: string;
  renderedText?: SafeHtml; // 新增用於儲存轉換後的 HTML
  date: Date;
  reply: boolean;
  user: { name: string; avatar?: string };
}