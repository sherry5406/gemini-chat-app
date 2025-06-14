import { Injectable, SecurityContext } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';

@Injectable({
  providedIn: 'root'
})
export class MarkdownService {
  constructor(private sanitizer: DomSanitizer) {}

  convertToHtml(markdown: string): SafeHtml {
    // 將 Markdown 轉換為 HTML
    const html = marked.parse(markdown) as string;
    // 清理並標記為安全的 HTML
    return this.sanitizer.sanitize(SecurityContext.HTML, html) || '';
  }
}