import { Inject, Injectable } from '@nestjs/common';
import * as https from 'https';
import * as os from 'os';
import { TELEGRAM_MODULE_OPTIONS } from './telegram.constants';
import { TelegramModuleOptions } from './telegram.interfaces';

function getServerIp(): string {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'unknown';
}

@Injectable()
export class TelegramService {
  constructor(
    @Inject(TELEGRAM_MODULE_OPTIONS)
    private readonly options: TelegramModuleOptions,
  ) {}

  async sendMessage(text: string): Promise<void> {
    const { botToken, chatId } = this.options;

    if (!botToken || !chatId) {
      console.warn('[TelegramService] botToken or chatId is not configured. Skipping notification.');
      return;
    }

    const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });

    return new Promise((resolve) => {
      const req = https.request(
        {
          hostname: 'api.telegram.org',
          path: `/bot${botToken}/sendMessage`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
        },
        (res) => {
          res.resume();
          resolve();
        },
      );

      req.on('error', (err) => {
        console.error(`[TelegramService] Failed to send message: ${err.message}`);
        resolve();
      });

      req.write(body);
      req.end();
    });
  }

  buildMessage(params: {
    level: string;
    message: string;
    context?: string;
    stack?: string;
    method?: string;
    url?: string;
    statusCode?: number;
    fileLoc?: string;
  }): string {
    const { level, message, context, stack, method, url, statusCode, fileLoc } = params;
    const env = process.env.NODE_ENV || 'development';
    const timestamp = new Date().toISOString();

    const lines: string[] = [
      `${level}`,
      `🕐 <b>${timestamp}</b>`,
      `🌍 Env: <b>${env}</b>`,
      `🖥️ IP: <b>${getServerIp()}</b>`,
    ];

    if (statusCode) lines.push(`📊 Status: <b>${statusCode}</b>`);
    if (method && url) lines.push(`🌐 Request: <b>${method} ${url}</b>`);
    if (context) lines.push(`📍 Context: <b>${context}</b>`);
    if (fileLoc) lines.push(`📂 File: <b>${fileLoc}</b>`);
    lines.push(`📝 <b>Message:</b> ${message}`);
    if (stack) lines.push(`\n🔍 <b>Stack:</b>\n<pre>${stack.substring(0, 800)}</pre>`);

    return lines.join('\n');
  }

  extractFileLocation(stack?: string): string | undefined {
    if (!stack) return undefined;

    const skipPatterns = [
      'node_modules',
      'node:internal',
      'TelegramLogger',
      'TelegramService',
      'ConsoleLogger',
      'NestApplication',
    ];

    const appLine = stack
      .split('\n')
      .find((l) => l.includes(' at ') && !skipPatterns.some((p) => l.includes(p)));

    if (!appLine) return undefined;

    const match =
      appLine.match(/\((.+?):(\d+):\d+\)/) ||
      appLine.match(/at (.+?):(\d+):\d+/);

    if (!match) return undefined;

    const fullPath = match[1];
    const line = match[2];
    const srcIdx = fullPath.indexOf('/src/');
    const shortPath = srcIdx >= 0 ? `src${fullPath.substring(srcIdx + 4)}` : fullPath;

    return `${shortPath}:${line}`;
  }
}
