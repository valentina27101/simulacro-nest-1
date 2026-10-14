import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../interfaces/authenticated-user.interface';

export const ROLES_KEY = 'roles';

// Guarda en los metadatos del endpoint los roles que pueden entrar.
// recibe uno o varios roles como argumentos y los guarda en un array de roles.
// guarda el array en los metadatos utilizando la clave roles
// Ejemplo: @Roles('admin', 'supervisor')
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
