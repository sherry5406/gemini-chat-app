import { Injectable } from '@angular/core';
import { GenerateContentResult, GoogleGenerativeAI } from '@google/generative-ai';
import { Observable, from, map, catchError, throwError, Subject } from 'rxjs';
import { environment } from '../../environments/environment.development';

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor() {
    this.genAI = new GoogleGenerativeAI(environment.geminiApiKey);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });
  }

  generateText(prompt: string): Observable<string> {
    return from(this.model.generateContent(prompt)).pipe(
      map((response: any) => {
        if (response && typeof response.response?.text === 'function') {
          return response.response.text();
        }
        throw new Error('無效的回應格式');
      }),
      catchError(error => {
        console.error('Gemini API 錯誤:', error);
        return throwError(() => new Error('無法生成內容，請稍後重試'));
      })
    );
  }

  private prompt = '你是一位親子教養專家，提供專業、溫暖且實用的建議，專注於兒童行為管理、情緒發展和家庭溝通。請用繁體中文回應，語氣親切並簡潔。';

  // 一般的生成方法（非串流）
  async generate(textInput: string, history: { text: string; reply: boolean }[]): Promise<string> {
    try {
      if (!textInput) return '請輸入問題。';

      const contents = this.buildContents(textInput, history);
      const result = await this.model.generateContent({
        contents: contents
      });

      return result.response.text();
    } catch (error) {
      console.error('Gemini 生成錯誤:', error);
      return '抱歉，無法生成回應，請稍後再試。';
    }
  }

  // 串流生成方法
  async *generateStream(textInput: string, history: { text: string; reply: boolean }[]): AsyncGenerator<string> {
    if (!textInput) {
      throw new Error('請輸入問題。');
    }

    try {
      const contents = this.buildContents(textInput, history);
      console.log('開始串流生成...', contents);

      const result = await this.model.generateContentStream({
        contents: contents
      });

      console.log('收到串流結果:', result);

      for await (const chunk of result.stream) {
        console.log('收到 chunk:', chunk);
        const chunkText = chunk.text();
        console.log('chunk 文字:', chunkText);
        if (chunkText) {
          yield chunkText;
        }
      }
    } catch (error) {
      console.error('Gemini 串流生成錯誤:', error);
      throw new Error('抱歉，無法生成回應，請稍後再試。');
    }
  }

  private buildContents(textInput: string, history: { text: string; reply: boolean }[]) {
    const contents = [];

    // 如果有歷史訊息，先加入歷史
    if (history.length > 0) {
      // 加入系統提示作為第一個 user 訊息
      contents.push({
        role: 'user',
        parts: [{ text: this.prompt }]
      });

      // 加入對話歷史
      history.forEach(msg => {
        contents.push({
          role: msg.reply ? 'user' : 'model',
          parts: [{ text: msg.text }]
        });
      });

      // 加入當前使用者輸入
      contents.push({
        role: 'user',
        parts: [{ text: textInput }]
      });
    } else {
      // 沒有歷史時，合併系統提示和使用者輸入
      contents.push({
        role: 'user',
        parts: [{ text: `${this.prompt}\n\n使用者問題: ${textInput}` }]
      });
    }

    console.log('建立的 contents:', contents);
    return contents;
  }


}