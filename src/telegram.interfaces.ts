import { ModuleMetadata, Type } from '@nestjs/common';

export interface TelegramModuleOptions {
  /** Telegram Bot Token from @BotFather */
  botToken: string;
  /** Telegram Chat ID or Group ID to send notifications */
  chatId: string;
  /**
   * Minimum log level to forward to Telegram.
   * 'warn' = warn + error | 'error' = error only
   * @default 'warn'
   */
  minLevel?: 'warn' | 'error';
}

export interface TelegramOptionsFactory {
  createTelegramOptions(): Promise<TelegramModuleOptions> | TelegramModuleOptions;
}

export interface TelegramModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: Type<TelegramOptionsFactory>;
  useClass?: Type<TelegramOptionsFactory>;
  useFactory?: (...args: any[]) => Promise<TelegramModuleOptions> | TelegramModuleOptions;
  inject?: any[];
}
