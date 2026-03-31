# @chungpham0412/nestjs-telegram-logger

[![npm version](https://img.shields.io/npm/v/@chungpham0412/nestjs-telegram-logger.svg)](https://www.npmjs.com/package/@chungpham0412/nestjs-telegram-logger)
[![license](https://img.shields.io/npm/l/@chungpham0412/nestjs-telegram-logger.svg)](LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-9%20%7C%2010%20%7C%2011-red.svg)](https://nestjs.com)

A lightweight NestJS module that automatically forwards `warn` and `error` logs to a Telegram group/channel with rich context — including environment, timestamp, server IP, client IP, request method/URL, source file location, and stack trace.

Also supports **bootstrap crash detection** via a standalone `sendAlert()` function that works outside NestJS's DI system.

No extra dependencies beyond NestJS and Node.js built-ins.

---

## Features

- **Zero extra dependencies** — uses Node's built-in `https` module to call the Telegram Bot API
- **Drop-in logger** — `TelegramLogger` extends NestJS's `ConsoleLogger`, so you keep all existing console output
- **Configurable minimum level** — forward `warn + error` or `error` only
- **Request context** — middleware automatically captures `method`, `url`, and **client IP** for every request
- **Server IP** — automatically included in every message via `os.networkInterfaces()`
- **Client IP** — reads `X-Forwarded-For` header (proxy-aware), falls back to socket address
- **Source file location** — resolves the originating `src/` file and line number from the stack trace
- **Bootstrap crash detection** — standalone `sendAlert()` works before NestJS DI is ready
- **Async configuration** — supports `forRootAsync` with `useFactory`, `useClass`, or `useExisting`
- **HTML-formatted messages** — readable, structured notifications in Telegram

---

## Installation

```bash
npm install @chungpham0412/nestjs-telegram-logger
# or
yarn add @chungpham0412/nestjs-telegram-logger
```

**Peer dependencies** (already present in any NestJS project):

```bash
npm install @nestjs/common @nestjs/core reflect-metadata express
```

---

## Quick Start

### 1. Create a Telegram Bot

1. Open Telegram and start a chat with [@BotFather](https://t.me/BotFather)
2. Send `/newbot` and follow the prompts → copy the **Bot Token**
3. Add the bot to your group/channel and get the **Chat ID**
   - For groups: send a message, then visit `https://api.telegram.org/bot<TOKEN>/getUpdates`

### 2. Register the Module

```typescript
// app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TelegramModule, RequestContextMiddleware } from '@chungpham0412/nestjs-telegram-logger';

@Module({
  imports: [
    TelegramModule.forRoot(), // reads TELEGRAM_BOT_TOKEN & TELEGRAM_CHAT_ID from process.env
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Captures method, URL, and client IP for every request
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
```

### 3. Use the Logger

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TelegramLogger, sendAlert } from '@chungpham0412/nestjs-telegram-logger';

const botToken = process.env.TELEGRAM_BOT_TOKEN ?? '';
const chatId = process.env.TELEGRAM_CHAT_ID ?? '';

// Catch crashes that happen before or outside NestJS (e.g. DB unreachable on startup)
process.on('uncaughtException', (err: Error) => {
  sendAlert({ botToken, chatId, message: err.message, stack: err.stack });
});
process.on('unhandledRejection', (reason: any) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  sendAlert({ botToken, chatId, message: err.message, stack: err.stack });
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(TelegramLogger));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

That's it. Every `logger.warn(...)` and `logger.error(...)` call in your application will now appear in your Telegram chat, and any unhandled bootstrap crash will trigger a `💀 CRITICAL` notification.

---

## Configuration

### Static — `forRoot(options?)`

`botToken` and `chatId` are optional — they fall back to `process.env.TELEGRAM_BOT_TOKEN` and `process.env.TELEGRAM_CHAT_ID` if not provided. If neither source has a value, all notifications are silently skipped.

```typescript
// Minimal — reads everything from .env
TelegramModule.forRoot()

// Or pass options explicitly
TelegramModule.forRoot({
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID',
  topicId: 'YOUR_TOPIC_ID', // optional — Telegram topic/thread ID for supergroups
  minLevel: 'warn', // 'warn' (default) | 'error'
})
```

### Async — `forRootAsync(options)`

#### Using `useFactory` + `ConfigService`

```typescript
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramModule } from '@chungpham0412/nestjs-telegram-logger';

TelegramModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (config: ConfigService) => ({
    botToken: config.get<string>('TELEGRAM_BOT_TOKEN'),
    chatId: config.get<string>('TELEGRAM_CHAT_ID'),
    minLevel: config.get<'warn' | 'error'>('TELEGRAM_MIN_LEVEL') ?? 'warn',
  }),
  inject: [ConfigService],
})
```

#### Using `useClass`

```typescript
import { Injectable } from '@nestjs/common';
import { TelegramOptionsFactory, TelegramModuleOptions } from '@chungpham0412/nestjs-telegram-logger';

@Injectable()
export class TelegramConfigService implements TelegramOptionsFactory {
  createTelegramOptions(): TelegramModuleOptions {
    return {
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
    };
  }
}

// In your module:
TelegramModule.forRootAsync({
  useClass: TelegramConfigService,
})
```

#### Using `useExisting`

```typescript
TelegramModule.forRootAsync({
  imports: [SharedConfigModule],
  useExisting: TelegramConfigService,
})
```

---

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `botToken` | `string` | `process.env.TELEGRAM_BOT_TOKEN` | Telegram bot token from @BotFather |
| `chatId` | `string` | `process.env.TELEGRAM_CHAT_ID` | Target chat/group/channel ID |
| `topicId` | `string \| number` | `process.env.TELEGRAM_TOPIC_ID` | Topic (thread) ID for supergroups with topics enabled (`message_thread_id`) |
| `minLevel` | `'warn' \| 'error'` | `'warn'` | Minimum log level to forward. `'warn'` sends both warnings and errors; `'error'` sends errors only |

---

## Bootstrap Crash Detection — `sendAlert()`

`sendAlert()` is a standalone function that sends a Telegram notification **without NestJS DI**. Use it in `process.on()` handlers and bootstrap try/catch blocks to capture crashes that occur before or outside the NestJS lifecycle.

> **Required env vars** — if `botToken`/`chatId` are not passed, the function reads `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from `process.env`. If neither source has a value, the alert is silently skipped.

```typescript
import { sendAlert } from '@chungpham0412/nestjs-telegram-logger';

// Minimal — reads credentials from process.env automatically
process.on('uncaughtException', (err) => {
  sendAlert({ message: err.message, stack: err.stack });
});

// Or pass credentials explicitly if needed
sendAlert({
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID',
  message: 'Something went wrong',
  stack: error.stack,
  // Optional:
  level: '💀 <b>CRITICAL — APP CRASHED</b>', // default
  context: 'Bootstrap',                        // default
  statusCode: 500,
  method: 'POST',
  url: '/api/orders',
});
```

### `SendAlertOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `botToken` | `string` | `process.env.TELEGRAM_BOT_TOKEN` | Telegram bot token. If omitted, reads from env. |
| `chatId` | `string` | `process.env.TELEGRAM_CHAT_ID` | Target chat ID. If omitted, reads from env. |
| `topicId` | `string \| number` | `process.env.TELEGRAM_TOPIC_ID` | Topic (thread) ID for supergroups with topics enabled (`message_thread_id`) |
| `message` | `string` | **required** | Error message text |
| `stack` | `string` | — | Error stack trace |
| `level` | `string` | `'💀 CRITICAL — APP CRASHED'` | Notification title/level |
| `context` | `string` | `'Bootstrap'` | Source context label |
| `statusCode` | `number` | — | HTTP status code |
| `method` | `string` | — | HTTP method |
| `url` | `string` | — | Request URL |

---

## Request Context Middleware

`RequestContextMiddleware` captures `method`, `url`, and **client IP** from every incoming request and makes them available to `TelegramLogger` via `AsyncLocalStorage`. This enriches error notifications with full request information.

Client IP is read from `X-Forwarded-For` first (proxy-aware), then falls back to the socket's remote address.

```typescript
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TelegramModule, RequestContextMiddleware } from '@chungpham0412/nestjs-telegram-logger';

@Module({
  imports: [TelegramModule.forRoot({ ... })],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
```

---

## Exported API

| Export | Description |
|--------|-------------|
| `TelegramModule` | The global NestJS module. Register once in `AppModule`. |
| `TelegramLogger` | Drop-in replacement for NestJS `ConsoleLogger`. Forwards `warn`/`error` to Telegram. |
| `TelegramService` | Lower-level service. Inject to call `sendMessage()` or `buildMessage()` directly. |
| `RequestContextMiddleware` | Express middleware that captures request context via `AsyncLocalStorage`. |
| `RequestContextService` | Service that reads the current `RequestContext` (method, url, clientIp). |
| `sendAlert` | Standalone alert function — works outside NestJS DI. Use in `process.on()` handlers. |
| `TelegramModuleOptions` | Interface for static options. |
| `TelegramModuleAsyncOptions` | Interface for async options. |
| `TelegramOptionsFactory` | Interface for `useClass`/`useExisting` factory pattern. |
| `SendAlertOptions` | Interface for `sendAlert()` options. |
| `TELEGRAM_MODULE_OPTIONS` | Injection token for module options. |

---

## Sending Custom Messages

Inject `TelegramService` directly for custom notifications:

```typescript
import { Injectable } from '@nestjs/common';
import { TelegramService } from '@chungpham0412/nestjs-telegram-logger';

@Injectable()
export class PaymentService {
  constructor(private readonly telegram: TelegramService) {}

  async processPayment(orderId: string) {
    try {
      // ... payment logic
    } catch (error) {
      const message = this.telegram.buildMessage({
        level: '🔴 <b>PAYMENT ERROR</b>',
        message: `Order ${orderId} failed: ${error.message}`,
        context: 'PaymentService',
        stack: error.stack, // 📂 File: is auto-resolved from this
      });
      await this.telegram.sendMessage(message);
      throw error;
    }
  }
}
```

### `buildMessage()` params

| Param | Type | Description |
|-------|------|--------------|
| `level` | `string` | **required** — notification title (e.g. `'🔴 <b>ERROR</b>'`) |
| `message` | `string` | **required** — error message text |
| `context` | `string` | NestJS context/service name |
| `stack` | `string` | Error stack trace (truncated to 800 chars). `📂 File:` is **auto-extracted** from this — no need to pass `fileLoc` separately |
| `method` | `string` | HTTP method |
| `url` | `string` | Request URL |
| `statusCode` | `number` | HTTP status code |
| `fileLoc` | `string` | Override the auto-resolved file location (optional) |
| `clientIp` | `string` | Client IP address |

---

## Example Telegram Messages

### Runtime error (from `TelegramLogger`)

```
🔴 ERROR
🕐 2026-03-30T10:45:12.345Z
🌍 Env: production
🖥️ Server IP: 192.168.1.10
👤 Client IP: 203.0.113.42
📊 Status: 500
🌐 Request: POST /api/orders
📍 Context: OrdersService
📂 File: src/orders/orders.service.ts:58
📝 Message: Cannot read properties of undefined (reading 'id')

🔍 Stack:
TypeError: Cannot read properties of undefined (reading 'id')
    at OrdersService.create (orders.service.ts:58:20)
    ...
```

### Bootstrap crash (from `sendAlert`)

```
💀 CRITICAL — APP CRASHED
🕐 2026-03-30T08:00:01.123Z
🌍 Env: production
🖥️ IP: 192.168.1.10
📍 Context: Bootstrap
📂 File: src/config/_database/prisma.service.ts:7
📝 Message: Can't reach database server at `db.host:5432`

🔍 Stack:
PrismaClientInitializationError: Can't reach database server...
    at async PrismaService.onModuleInit (prisma.service.ts:7:5)
    ...
```

---

## Full Example

```typescript
// app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramModule, RequestContextMiddleware } from '@chungpham0412/nestjs-telegram-logger';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TelegramModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        botToken: config.getOrThrow('TELEGRAM_BOT_TOKEN'),
        chatId: config.getOrThrow('TELEGRAM_CHAT_ID'),
        minLevel: 'warn',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
```

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TelegramLogger, sendAlert } from '@chungpham0412/nestjs-telegram-logger';

process.on('uncaughtException', (err: Error) => {
  sendAlert({ message: err.message, stack: err.stack });
});
process.on('unhandledRejection', (reason: any) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  sendAlert({ message: err.message, stack: err.stack });
});

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(TelegramLogger));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

```env
# .env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ
TELEGRAM_CHAT_ID=-1001234567890
TELEGRAM_TOPIC_ID=456  # optional — only needed for supergroup topics
```

---

## License

MIT © [chungpham0412@gmail.com](mailto:chungpham0412@gmail.com)
