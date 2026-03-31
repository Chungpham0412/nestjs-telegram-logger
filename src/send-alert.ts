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

function extractFileLocation(stack?: string): string | undefined {
  if (!stack) return undefined;

  const skipPatterns = [
    'node_modules',
    'node:internal',
    'TelegramLogger',
    'TelegramService',
    'ConsoleLogger',
    'NestApplication',
    'send-alert',
  ];

  const appLine = stack
    .split('\n')
    .find((l) => l.trimStart().startsWith('at ') && !skipPatterns.some((p) => l.includes(p)));

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

export interface SendAlertOptions {
  botToken?: string;
  chatId?: string;
  /** Telegram Topic (thread) ID — message_thread_id in the Bot API. Defaults to process.env.TELEGRAM_TOPIC_ID */
  topicId?: string | number;
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
 *   sendAlert({ message: err.message, stack: err.stack });
 * });
 */
export function sendAlert(options: SendAlertOptions): void {
  const {
    botToken = process.env.TELEGRAM_BOT_TOKEN ?? '',
    chatId = process.env.TELEGRAM_CHAT_ID ?? '',
    topicId = process.env.TELEGRAM_TOPIC_ID,
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
  const now = new Date();
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
      .formatToParts(now).filter(x => x.type !== 'literal').map(x => [x.type, x.value])
  );
  const timestamp = `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}:${p.second}`;
  const lines: string[] = [
    level,
    `🕐 <b>${timestamp}</b>`,
    `🌍 Env: <b>${env}</b>`,
    `🖥️ IP: <b>${getServerIp()}</b>`,
  ];

  if (statusCode) lines.push(`📊 Status: <b>${statusCode}</b>`);
  if (method && url) lines.push(`🌐 Request: <b>${method} ${url}</b>`);
  if (context) lines.push(`📍 Context: <b>${context}</b>`);

  const fileLoc = extractFileLocation(stack);
  if (fileLoc) lines.push(`📂 File: <b>${fileLoc}</b>`);

  lines.push(`📝 <b>Message:</b> ${message}`);
  if (stack) lines.push(`\n🔍 <b>Stack:</b>\n<pre>${stack.substring(0, 800)}</pre>`);

  const text = lines.join('\n');
  const payload: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' };
  if (topicId !== undefined && topicId !== null && topicId !== '') {
    payload.message_thread_id = Number(topicId);
  }
  const body = JSON.stringify(payload);

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
