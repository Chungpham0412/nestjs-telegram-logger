import { ConsoleLogger, Inject, Injectable, Optional } from '@nestjs/common';
import { TELEGRAM_MODULE_OPTIONS } from './telegram.constants';
import { TelegramModuleOptions } from './telegram.interfaces';
import { TelegramService } from './telegram.service';
import { RequestContextService } from './request-context.service';

const SKIP_CONTEXTS = new Set(['TelegramService', 'TelegramLogger']);

@Injectable()
export class TelegramLogger extends ConsoleLogger {
  private readonly minLevel: 'warn' | 'error';

  constructor(
    private readonly telegramService: TelegramService,
    @Optional() private readonly requestContextService?: RequestContextService,
    @Optional()
    @Inject(TELEGRAM_MODULE_OPTIONS)
    options?: TelegramModuleOptions,
  ) {
    super();
    this.minLevel = options?.minLevel ?? 'warn';
  }

  error(message: any, ...optionalParams: any[]): void {
    super.error(message, ...optionalParams);

    const { context, stack } = this.extractNestParams(optionalParams);
    if (context && SKIP_CONTEXTS.has(context)) return;

    const reqCtx = this.requestContextService?.get();
    const fileLoc = this.telegramService.extractFileLocation(stack ?? this.captureStack());

    const text = this.telegramService.buildMessage({
      level: '🔴 <b>ERROR</b>',
      message: this.stringify(message),
      context,
      stack,
      fileLoc,
      method: reqCtx?.method,
      url: reqCtx?.url,
      clientIp: reqCtx?.clientIp,
    });

    this.telegramService.sendMessage(text).catch(() => {});
  }

  warn(message: any, ...optionalParams: any[]): void {
    super.warn(message, ...optionalParams);

    if (this.minLevel === 'error') return;

    const { context } = this.extractNestParams(optionalParams);
    if (context && SKIP_CONTEXTS.has(context)) return;

    const reqCtx = this.requestContextService?.get();
    const fileLoc = this.telegramService.extractFileLocation(this.captureStack());

    const text = this.telegramService.buildMessage({
      level: '⚠️ <b>WARNING</b>',
      message: this.stringify(message),
      context,
      fileLoc,
      method: reqCtx?.method,
      url: reqCtx?.url,
      clientIp: reqCtx?.clientIp,
    });

    this.telegramService.sendMessage(text).catch(() => {});
  }

  private captureStack(): string {
    return new Error().stack ?? '';
  }

  private extractNestParams(optionalParams: any[]): { context?: string; stack?: string } {
    if (!optionalParams?.length) return {};
    const last = optionalParams[optionalParams.length - 1];
    const context = typeof last === 'string' ? last : undefined;
    const first = optionalParams[0];
    const stack = typeof first === 'string' && first !== context ? first : undefined;
    return { context, stack };
  }

  private stringify(message: any): string {
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(message, null, 2);
    } catch {
      return String(message);
    }
  }
}
