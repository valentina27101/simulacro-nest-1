import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

// Usuarios de prueba definidos en memoria (el documento lo permite).
// El valor del encabezado x-user debe ser uno de estos "username".
export const USUARIOS_DE_PRUEBA: AuthenticatedUser[] = [
  { username: 'admin1', nombre: 'Ana Administradora', rol: 'admin' },
  { username: 'supervisor1', nombre: 'Sergio Supervisor', rol: 'supervisor' },
  { username: 'asesor1', nombre: 'Carlos Asesor', rol: 'asesor' },
  { username: 'asesor2', nombre: 'Laura Asesora', rol: 'asesor' },
];
