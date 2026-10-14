export type Rol = 'admin' | 'supervisor' | 'asesor';

// Usuario que ya fue validado contra la lista definida en el servidor.
export interface AuthenticatedUser {
  username: string;
  nombre: string;
  rol: Rol;
}
