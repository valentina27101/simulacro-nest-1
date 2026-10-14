import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

// Claves de prueba: no se usa el .env real.
export const CLAVE_1 = 'clave-prueba-1';
export const CLAVE_2 = 'clave-prueba-2';

// Crea la app con la misma configuración global que main.ts y una base SQLite
// en memoria (cada llamada crea una base nueva y vacía).
export async function crearApp(): Promise<INestApplication> {
  // Las variables se definen ANTES de cargar el módulo para que la configuración las lea.
  process.env.API_KEYS = ` ${CLAVE_1} , ${CLAVE_2} `;
  process.env.DB_PATH = ':memory:';
  const { AppModule } = await import('../src/app.module');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  return app;
}

// Atajo para no repetir los encabezados en cada petición.
// clave = null significa "no enviar x-api-key".
export function crearCliente(app: INestApplication) {
  return (usuario?: string, clave: string | null = CLAVE_1) => {
    const headers: Record<string, string> = {};
    if (clave) headers['x-api-key'] = clave;
    if (usuario) headers['x-user'] = usuario;
    const server = app.getHttpServer();
    return {
      get: (url: string) => request(server).get(url).set(headers),
      post: (url: string) => request(server).post(url).set(headers),
      patch: (url: string) => request(server).patch(url).set(headers),
      put: (url: string) => request(server).put(url).set(headers),
      delete: (url: string) => request(server).delete(url).set(headers),
    };
  };
}
