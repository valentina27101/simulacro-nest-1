import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

// Primer guard: revisa que venga un x-api-key válido.
// Si falla, el endpoint nunca se ejecuta.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];

    if (typeof apiKey !== 'string' || apiKey.trim() === '') {
      throw new UnauthorizedException('Falta el encabezado x-api-key');
    }

    const clavesValidas = this.configService.get<string[]>('apiKeys') ?? [];
    if (!clavesValidas.includes(apiKey.trim())) {
      throw new UnauthorizedException('La API Key no es válida');
    }

    return true;
  }
}
