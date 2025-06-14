import { Injectable } from '@angular/core';
import { GenerateContentResult, GoogleGenerativeAI } from '@google/generative-ai';
import { Observable, from, map, catchError, throwError } from 'rxjs';
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

  async generate(textInput: string, history: { text: string; reply: boolean }[]): Promise<string> {
    try {
      if (!textInput) return '請輸入問題。';

      // 建立對話內容陣列
      const contents = [];

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

      const result = await this.model.generateContent({
        contents: contents
      });

      return result.response.text();
    } catch (error) {
      console.error('Gemini 生成錯誤:', error);
      return '抱歉，無法生成回應，請稍後再試。';
    }
  }
}