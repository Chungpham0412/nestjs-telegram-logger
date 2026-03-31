import { ModuleMetadata, Type } from '@nestjs/common';

export interface TelegramModuleOptions {
  /** Telegram Bot Token from @BotFather. Defaults to process.env.TELEGRAM_BOT_TOKEN */
  botToken?: string;
  /** Telegram Chat ID or Group ID to send notifications. Defaults to process.env.TELEGRAM_CHAT_ID */
  chatId?: string;
  /**
   * Minimum log level to forward to Telegram.
   * 'warn' = warn + error | 'error' = error only
   * @default 'warn'
   */
  minLevel?: 'warn' | 'error';
  /**
   * Telegram Topic (thread) ID — message_thread_id in the Bot API.
   * Required when sending to a specific topic inside a supergroup.
   * Defaults to process.env.TELEGRAM_TOPIC_ID
   */
  topicId?: string | number;
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
