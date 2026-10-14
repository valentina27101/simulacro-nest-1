import { SetMetadata } from '@nestjs/common';
import type { Rol } from '../interfaces/authenticated-user.interface';

export const ROLES_KEY = 'roles';

// Guarda en los metadatos del endpoint los roles que pueden entrar.
// Ejemplo: @Roles('admin', 'supervisor')
export const Roles = (...roles: Rol[]) => SetMetadata(ROLES_KEY, roles);
