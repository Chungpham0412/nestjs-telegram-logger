# @ttl/nestjs-telegram-logger

[![npm version](https://img.shields.io/npm/v/@ttl/nestjs-telegram-logger.svg)](https://www.npmjs.com/package/@ttl/nestjs-telegram-logger)
[![license](https://img.shields.io/npm/l/@ttl/nestjs-telegram-logger.svg)](LICENSE)
[![NestJS](https://img.shields.io/badge/NestJS-9%20%7C%2010%20%7C%2011-red.svg)](https://nestjs.com)

A lightweight NestJS module that automatically forwards `warn` and `error` logs to a Telegram group/channel with rich context — including environment, timestamp, request method/URL, source file location, and stack trace.

No extra dependencies beyond NestJS and Node.js built-ins.

---

## Features

- **Zero extra dependencies** — uses Node's built-in `https` module to call the Telegram Bot API
- **Drop-in logger** — `TelegramLogger` extends NestJS's `ConsoleLogger`, so you keep all existing console output
- **Configurable minimum level** — forward `warn + error` or `error` only
- **Request context** — middleware automatically attaches `method` and `url` to every log message
- **Async configuration** — supports `forRootAsync` with `useFactory`, `useClass`, or `useExisting`
- **HTML-formatted messages** — readable, structured notifications in Telegram

---

## Installation

```bash
npm install @ttl/nestjs-telegram-logger
# or
yarn add @ttl/nestjs-telegram-logger
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
import { Module } from '@nestjs/common';
import { TelegramModule } from '@ttl/nestjs-telegram-logger';

@Module({
  imports: [
    TelegramModule.forRoot({
      botToken: process.env.TELEGRAM_BOT_TOKEN,
      chatId: process.env.TELEGRAM_CHAT_ID,
    }),
  ],
})
export class AppModule {}
```

### 3. Use the Logger

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { TelegramLogger } from '@ttl/nestjs-telegram-logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(TelegramLogger));
  await app.listen(3000);
}
bootstrap();
```

That's it. Every `logger.warn(...)` and `logger.error(...)` call in your application will now appear in your Telegram chat.

---

## Configuration

### Static — `forRoot(options)`

```typescript
TelegramModule.forRoot({
  botToken: 'YOUR_BOT_TOKEN',
  chatId: 'YOUR_CHAT_ID',
  minLevel: 'warn', // 'warn' (default) | 'error'
})
```

### Async — `forRootAsync(options)`

#### Using `useFactory` + `ConfigService`

```typescript
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramModule } from '@ttl/nestjs-telegram-logger';

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
import { TelegramOptionsFactory, TelegramModuleOptions } from '@ttl/nestjs-telegram-logger';

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
| `botToken` | `string` | **required** | Telegram bot token from @BotFather |
| `chatId` | `string` | **required** | Target chat/group/channel ID |
| `minLevel` | `'warn' \| 'error'` | `'warn'` | Minimum log level to forward. `'warn'` sends both warnings and errors; `'error'` sends errors only |

---

## Request Context Middleware

To include the HTTP request method and URL in log messages, apply `RequestContextMiddleware` in your `AppModule`:

```typescript
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { TelegramModule, RequestContextMiddleware } from '@ttl/nestjs-telegram-logger';

@Module({
  imports: [TelegramModule.forRoot({ ... })],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
```

When a request is in-flight and an error is logged, the Telegram message will automatically include `GET /api/users/123` (or whatever the current request is).

---

## Exported API

| Export | Description |
|--------|-------------|
| `TelegramModule` | The global NestJS module. Register once in `AppModule`. |
| `TelegramLogger` | Drop-in replacement for NestJS `ConsoleLogger`. Forward to Telegram on `warn`/`error`. |
| `TelegramService` | Lower-level service. Inject to call `sendMessage()` directly. |
| `RequestContextMiddleware` | Express middleware that sets request context via `AsyncLocalStorage`. |
| `RequestContextService` | Service that stores and retrieves the current `RequestContext`. |
| `TelegramModuleOptions` | Interface for static options. |
| `TelegramModuleAsyncOptions` | Interface for async options. |
| `TelegramOptionsFactory` | Interface for `useClass`/`useExisting` factory pattern. |

---

## Sending Custom Messages

Inject `TelegramService` directly for custom notifications:

```typescript
import { Injectable } from '@nestjs/common';
import { TelegramService } from '@ttl/nestjs-telegram-logger';

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
        stack: error.stack,
      });
      await this.telegram.sendMessage(message);
      throw error;
    }
  }
}
```

---

## Example Telegram Message

```
🔴 ERROR
🕐 2026-03-30T10:45:12.345Z
🌍 Env: production
🌐 Request: POST /api/orders
📍 Context: OrdersService
📂 File: src/orders/orders.service.ts:58
📝 Message: Cannot read properties of undefined (reading 'id')

🔍 Stack:
TypeError: Cannot read properties of undefined (reading 'id')
    at OrdersService.create (orders.service.ts:58:20)
    ...
```

---

## Full Example

```typescript
// app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TelegramModule, RequestContextMiddleware } from '@ttl/nestjs-telegram-logger';

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
import { TelegramLogger } from '@ttl/nestjs-telegram-logger';

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
```

---

## License

MIT © [chungpham0412@gmail.com](mailto:chungpham0412@gmail.com)
