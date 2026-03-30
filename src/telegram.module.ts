import { DynamicModule, Global, Module, Provider } from '@nestjs/common';
import { TELEGRAM_MODULE_OPTIONS } from './telegram.constants';
import {
  TelegramModuleAsyncOptions,
  TelegramModuleOptions,
  TelegramOptionsFactory,
} from './telegram.interfaces';
import { TelegramService } from './telegram.service';
import { TelegramLogger } from './telegram.logger';
import { RequestContextService } from './request-context.service';
import { RequestContextMiddleware } from './request-context.middleware';

const CORE_PROVIDERS = [TelegramService, TelegramLogger, RequestContextService, RequestContextMiddleware];
const EXPORTS = [...CORE_PROVIDERS];

@Global()
@Module({})
export class TelegramModule {
  /**
   * Configure with static options.
   * @example
   * TelegramModule.forRoot({
   *   botToken: process.env.TELEGRAM_BOT_TOKEN,
   *   chatId: process.env.TELEGRAM_CHAT_ID,
   * })
   */
  static forRoot(options: TelegramModuleOptions = {}): DynamicModule {
    const resolved: TelegramModuleOptions = {
      botToken: options.botToken ?? process.env.TELEGRAM_BOT_TOKEN ?? '',
      chatId: options.chatId ?? process.env.TELEGRAM_CHAT_ID ?? '',
      minLevel: options.minLevel,
    };
    return {
      module: TelegramModule,
      providers: [
        { provide: TELEGRAM_MODULE_OPTIONS, useValue: resolved },
        ...CORE_PROVIDERS,
      ],
      exports: EXPORTS,
    };
  }

  /**
   * Configure asynchronously (e.g. via ConfigService).
   * @example
   * TelegramModule.forRootAsync({
   *   imports: [ConfigModule],
   *   useFactory: (config: ConfigService) => ({
   *     botToken: config.get('TELEGRAM_BOT_TOKEN'),
   *     chatId: config.get('TELEGRAM_CHAT_ID'),
   *   }),
   *   inject: [ConfigService],
   * })
   */
  static forRootAsync(options: TelegramModuleAsyncOptions): DynamicModule {
    return {
      module: TelegramModule,
      imports: options.imports ?? [],
      providers: [
        ...TelegramModule.createAsyncProviders(options),
        ...CORE_PROVIDERS,
      ],
      exports: EXPORTS,
    };
  }

  private static createAsyncProviders(options: TelegramModuleAsyncOptions): Provider[] {
    if (options.useFactory) {
      return [
        {
          provide: TELEGRAM_MODULE_OPTIONS,
          useFactory: options.useFactory,
          inject: options.inject ?? [],
        },
      ];
    }

    if (options.useExisting || options.useClass) {
      const factoryClass = (options.useExisting ?? options.useClass)!;
      return [
        {
          provide: TELEGRAM_MODULE_OPTIONS,
          useFactory: (factory: TelegramOptionsFactory) => factory.createTelegramOptions(),
          inject: [factoryClass],
        },
        ...(options.useClass ? [{ provide: factoryClass, useClass: options.useClass }] : []),
      ];
    }

    throw new Error('TelegramModule: must provide useFactory, useClass, or useExisting');
  }
}
