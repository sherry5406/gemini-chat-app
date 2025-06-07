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
}