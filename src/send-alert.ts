import * as https from 'https';
import * as os from 'os';

function getServerIp(): string {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const addr of iface ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return 'unknown';
}

export interface SendAlertOptions {
  botToken: string;
  chatId: string;
  level?: string;
  context?: string;
  message: string;
  stack?: string;
  method?: string;
  url?: string;
  statusCode?: number;
}

/**
 * Standalone Telegram alert — works without NestJS DI.
 * Use this in main.ts bootstrap to catch startup/crash errors.
 *
 * @example
 * import { sendAlert } from '@chungpham0412/nestjs-telegram-logger';
 *
 * process.on('uncaughtException', (err) => {
 *   sendAlert({ botToken, chatId, message: err.message, stack: err.stack });
 * });
 */
export function sendAlert(options: SendAlertOptions): void {
  const {
    botToken,
    chatId,
    level = '💀 <b>CRITICAL — APP CRASHED</b>',
    context = 'Bootstrap',
    message,
    stack,
    method,
    url,
    statusCode,
  } = options;

  if (!botToken || !chatId) return;

  const env = process.env.NODE_ENV || 'development';
  const lines: string[] = [
    level,
    `🕐 <b>${new Date().toISOString()}</b>`,
    `🌍 Env: <b>${env}</b>`,
    `🖥️ IP: <b>${getServerIp()}</b>`,
  ];

  if (statusCode) lines.push(`📊 Status: <b>${statusCode}</b>`);
  if (method && url) lines.push(`🌐 Request: <b>${method} ${url}</b>`);
  if (context) lines.push(`📍 Context: <b>${context}</b>`);
  lines.push(`📝 <b>Message:</b> ${message}`);
  if (stack) lines.push(`\n🔍 <b>Stack:</b>\n<pre>${stack.substring(0, 800)}</pre>`);

  const text = lines.join('\n');
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });

  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${botToken}/sendMessage`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  });
  req.on('error', () => {});
  req.write(body);
  req.end();
}
