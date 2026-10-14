import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

// Claves de prueba y base de datos en memoria: no se toca el .env ni el archivo .sqlite.
const CLAVE_1 = 'clave-prueba-1';
const CLAVE_2 = 'clave-prueba-2';

describe('API de solicitudes (e2e)', () => {
  let app: INestApplication;

  // Atajo para no repetir los encabezados en cada petición.
  // clave = null significa "no enviar x-api-key".
  const api = (usuario?: string, clave: string | null = CLAVE_1) => {
    const headers: Record<string, string> = {};
    if (clave) headers['x-api-key'] = clave;
    if (usuario) headers['x-user'] = usuario;
    const server = app.getHttpServer();
    return {
      get: (url: string) => request(server).get(url).set(headers),
      post: (url: string) => request(server).post(url).set(headers),
      patch: (url: string) => request(server).patch(url).set(headers),
    };
  };

  beforeAll(async () => {
    // Las variables se definen ANTES de cargar el módulo para que la configuración las lea.
    process.env.API_KEYS = ` ${CLAVE_1} , ${CLAVE_2} `;
    process.env.DB_PATH = ':memory:';
    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // Misma configuración global que main.ts
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
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Protección con x-api-key y x-user', () => {
    it('1. sin x-api-key: 401', async () => {
      const res = await api('admin1', null).get('/solicitudes');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('2. con x-api-key inválida: 401', async () => {
      const res = await api('admin1', 'clave-falsa').get('/solicitudes');
      expect(res.status).toBe(401);
    });

    it('3. primera clave configurada: 200', async () => {
      const res = await api('admin1', CLAVE_1).get('/solicitudes');
      expect(res.status).toBe(200);
    });

    it('4. segunda clave configurada: 200 (se ignoran espacios del .env)', async () => {
      const res = await api('admin1', CLAVE_2).get('/solicitudes');
      expect(res.status).toBe(200);
    });

    it('5. sin x-user: 401', async () => {
      const res = await api(undefined).get('/solicitudes');
      expect(res.status).toBe(401);
    });

    it('6. usuario inexistente: 401', async () => {
      const res = await api('hacker').get('/solicitudes');
      expect(res.status).toBe(401);
    });

    it('la API Key inválida se rechaza antes de revisar el usuario', async () => {
      const res = await api('hacker', 'clave-falsa').get('/solicitudes');
      expect(res.status).toBe(401);
      expect(res.body.message).toContain('API Key');
    });
  });

  describe('Registro de solicitudes (RN-01)', () => {
    it('7. registro correcto: 201 con estado PENDIENTE', async () => {
      const res = await api('supervisor1')
        .post('/solicitudes')
        .send({ cliente: 'Cliente Uno', descripcion: 'Pide cotización' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        cliente: 'Cliente Uno',
        descripcion: 'Pide cotización',
        estado: 'PENDIENTE',
        asesor: 'supervisor1',
      });
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.creadaEn).toBeDefined();
      expect(res.body.data.actualizadaEn).toBeDefined();
    });

    it('8. datos obligatorios vacíos o faltantes: 400', async () => {
      const vacios = await api('asesor1')
        .post('/solicitudes')
        .send({ cliente: '', descripcion: '   ' });
      expect(vacios.status).toBe(400);
      expect(vacios.body.success).toBe(false);

      const faltantes = await api('asesor1').post('/solicitudes').send({});
      expect(faltantes.status).toBe(400);

      const tipoIncorrecto = await api('asesor1')
        .post('/solicitudes')
        .send({ cliente: 123, descripcion: 'x' });
      expect(tipoIncorrecto.status).toBe(400);
    });

    it('9. un asesor queda como responsable y el estado es PENDIENTE', async () => {
      const res = await api('asesor1')
        .post('/solicitudes')
        .send({ cliente: 'Cliente Asesor 1', descripcion: 'Seguimiento' });

      expect(res.status).toBe(201);
      expect(res.body.data.asesor).toBe('asesor1');
      expect(res.body.data.estado).toBe('PENDIENTE');
    });

    it('no permite enviar id, fechas, estado ni asesor en el cuerpo: 400', async () => {
      const res = await api('asesor1').post('/solicitudes').send({
        cliente: 'X',
        descripcion: 'Y',
        id: 999,
        estado: 'RESUELTA',
        asesor: 'asesor2',
        creadaEn: '2020-01-01',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('Consulta de solicitudes (RN-02)', () => {
    beforeAll(async () => {
      // Una solicitud para asesor2, para comparar con las de asesor1.
      await api('asesor2')
        .post('/solicitudes')
        .send({ cliente: 'Cliente Asesor 2', descripcion: 'Seguimiento' });
    });

    it('10. admin consulta todas', async () => {
      const res = await api('admin1').get('/solicitudes');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
    });

    it('11. supervisor consulta todas', async () => {
      const res = await api('supervisor1').get('/solicitudes');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
    });

    it('12. un asesor solo ve las suyas', async () => {
      const res = await api('asesor1').get('/solicitudes');
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data.every((s: { asesor: string }) => s.asesor === 'asesor1')).toBe(true);
    });

    it('un asesor consulta una solicitud propia por id: 200', async () => {
      const lista = await api('asesor1').get('/solicitudes');
      const id = lista.body.data[0].id;
      const res = await api('asesor1').get(`/solicitudes/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(id);
    });

    it('13. un asesor no puede consultar una solicitud ajena por id: 404', async () => {
      const listaAsesor2 = await api('asesor2').get('/solicitudes');
      const idAjeno = listaAsesor2.body.data[0].id;

      const res = await api('asesor1').get(`/solicitudes/${idAjeno}`);
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);

      // El admin sí la puede ver.
      const admin = await api('admin1').get(`/solicitudes/${idAjeno}`);
      expect(admin.status).toBe(200);
    });

    it('20. solicitud inexistente: 404', async () => {
      const res = await api('admin1').get('/solicitudes/9999');
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('9999');
    });

    it('id que no es número: 400', async () => {
      const res = await api('admin1').get('/solicitudes/abc');
      expect(res.status).toBe(400);
    });
  });

  describe('Cambio de estado (RN-03)', () => {
    let idAsesor1: number;
    let idAsesor2: number;

    beforeAll(async () => {
      const a1 = await api('asesor1').get('/solicitudes');
      idAsesor1 = a1.body.data[0].id;
      const a2 = await api('asesor2').get('/solicitudes');
      idAsesor2 = a2.body.data[0].id;
    });

    it('14. un asesor no puede cambiar el estado de una solicitud ajena', async () => {
      const res = await api('asesor1')
        .patch(`/solicitudes/${idAsesor2}/estado`)
        .send({ estado: 'EN_GESTION' });
      expect(res.status).toBe(404);

      // Y el estado no cambió.
      const sigue = await api('admin1').get(`/solicitudes/${idAsesor2}`);
      expect(sigue.body.data.estado).toBe('PENDIENTE');
    });

    it('15. y 16. supervisor cambia PENDIENTE -> EN_GESTION', async () => {
      const res = await api('supervisor1')
        .patch(`/solicitudes/${idAsesor2}/estado`)
        .send({ estado: 'EN_GESTION' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.estado).toBe('EN_GESTION');
    });

    it('15. y 17. admin cambia EN_GESTION -> RESUELTA', async () => {
      const res = await api('admin1')
        .patch(`/solicitudes/${idAsesor2}/estado`)
        .send({ estado: 'RESUELTA' });
      expect(res.status).toBe(200);
      expect(res.body.data.estado).toBe('RESUELTA');
    });

    it('18. PENDIENTE -> RESUELTA directo: 400', async () => {
      const res = await api('asesor1')
        .patch(`/solicitudes/${idAsesor1}/estado`)
        .send({ estado: 'RESUELTA' });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('PENDIENTE');
      expect(res.body.message).toContain('RESUELTA');
    });

    it('un asesor cambia el estado de su propia solicitud: 200', async () => {
      const res = await api('asesor1')
        .patch(`/solicitudes/${idAsesor1}/estado`)
        .send({ estado: 'EN_GESTION' });
      expect(res.status).toBe(200);
      expect(res.body.data.estado).toBe('EN_GESTION');
    });

    it('19. reabrir una solicitud RESUELTA: 400', async () => {
      for (const estado of ['PENDIENTE', 'EN_GESTION']) {
        const res = await api('admin1')
          .patch(`/solicitudes/${idAsesor2}/estado`)
          .send({ estado });
        expect(res.status).toBe(400);
      }
    });

    it('estado que no existe: 400', async () => {
      const res = await api('admin1')
        .patch(`/solicitudes/${idAsesor1}/estado`)
        .send({ estado: 'CANCELADA' });
      expect(res.status).toBe(400);
    });

    it('no se pueden cambiar otros campos con este endpoint: 400', async () => {
      const res = await api('admin1')
        .patch(`/solicitudes/${idAsesor1}/estado`)
        .send({ estado: 'RESUELTA', cliente: 'Otro', asesor: 'asesor2' });
      expect(res.status).toBe(400);

      const sigue = await api('admin1').get(`/solicitudes/${idAsesor1}`);
      expect(sigue.body.data.cliente).toBe('Cliente Asesor 1');
      expect(sigue.body.data.asesor).toBe('asesor1');
    });

    it('20. cambiar estado de una solicitud inexistente: 404', async () => {
      const res = await api('admin1')
        .patch('/solicitudes/9999/estado')
        .send({ estado: 'EN_GESTION' });
      expect(res.status).toBe(404);
    });
  });

  describe('Formato de respuestas', () => {
    it('21. las respuestas exitosas tienen { success: true, data }', async () => {
      const lista = await api('admin1').get('/solicitudes');
      expect(Object.keys(lista.body).sort()).toEqual(['data', 'success']);
      expect(lista.body.success).toBe(true);

      const una = await api('admin1').get(`/solicitudes/${lista.body.data[0].id}`);
      expect(Object.keys(una.body).sort()).toEqual(['data', 'success']);
    });

    it('22. los errores tienen { success, statusCode, message, timestamp } y conservan su código', async () => {
      const casos = [
        { res: await api('admin1', 'mala').get('/solicitudes'), codigo: 401 },
        { res: await api('admin1').get('/solicitudes/9999'), codigo: 404 },
        {
          res: await api('admin1').post('/solicitudes').send({}),
          codigo: 400,
        },
      ];

      for (const { res, codigo } of casos) {
        expect(res.status).toBe(codigo);
        expect(res.body.success).toBe(false);
        expect(res.body.statusCode).toBe(codigo);
        expect(res.body.message).toBeDefined();
        expect(new Date(res.body.timestamp).toString()).not.toBe('Invalid Date');
      }
    });
  });
});
