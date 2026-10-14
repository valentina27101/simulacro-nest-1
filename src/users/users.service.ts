import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { USUARIOS_DE_PRUEBA } from './users.data';

@Injectable()
export class UsersService {
  // Busca un usuario en la lista del servidor. Devuelve undefined si no existe.
  findByUsername(username: string): AuthenticatedUser | undefined {
    return USUARIOS_DE_PRUEBA.find((usuario) => usuario.username === username);
  }
}
