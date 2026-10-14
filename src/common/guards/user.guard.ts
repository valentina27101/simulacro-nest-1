import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from '../../users/users.service';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

// Segundo guard: identifica al usuario con x-user.
// El rol sale de la lista del servidor, nunca de lo que envíe el cliente.
@Injectable()
export class UserGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthenticatedUser }>();
    const username = request.headers['x-user'];

    if (typeof username !== 'string' || username.trim() === '') {
      throw new UnauthorizedException('Falta el encabezado x-user');
    }

    const usuario = this.usersService.findByUsername(username.trim());
    if (!usuario) {
      throw new UnauthorizedException(`El usuario "${username}" no existe`);
    }

    // Se guarda en la petición para que @CurrentUser() lo pueda leer.
    request.user = usuario;
    return true;
  }
}
