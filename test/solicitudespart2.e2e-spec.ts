import { INestApplication, Logger } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { SolicitudHistorial } from '../src/solicitudes/entities/solicitud-historial.entity';
import { crearApp, crearCliente } from './helpers';

// Pruebas de la parte 2: RN-07 (asignación), RN-08 (filtros y paginación)
// y RN-09 (historial). Cada bloque usa su propia base en memoria.

type Api = ReturnType<typeof crearCliente>;
type Cuerpo = { cliente: string; descripcion: string };

async function crear(api: Api, usuario: string, cuerpo: Cuerpo) {
  const res = await api(usuario).post('/solicitudes').send(cuerpo);
  expect(res.status).toBe(201);
  return res.body.data as { id: number; asesor: string | null; estado: string };
}

async function cambiarEstado(api: Api, usuario: string, id: number, estado: string) {
  const res = await api(usuario).patch(`/solicitudes/${id}/estado`).send({ estado });
  expect(res.status).toBe(200);
}

describe('RN-07 Asignación', () => {
  let app: INestApplication;
  let api: Api;

  beforeAll(async () => {
    app = await crearApp();
    api = crearCliente(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('Escenario 12: un supervisor crea una solicitud sin asignar, PENDIENTE y con evento CREACION', async () => {
    const s = await crear(api, 'supervisor1', { cliente: 'Cliente A', descripcion: 'x' });
    expect(s.asesor).toBeNull();
    expect(s.estado).toBe('PENDIENTE');

    const historial = await api('admin1').get(`/solicitudes/${s.id}/historial`);
    expect(historial.body.data).toHaveLength(1);
    expect(historial.body.data[0]).toMatchObject({
      tipoEvento: 'CREACION',
      valorAnterior: null,
      valorNuevo: 'PENDIENTE',
      usuarioActor: 'supervisor1',
    });
  });

  it('un admin también crea la solicitud sin asignar', async () => {
    const s = await crear(api, 'admin1', { cliente: 'Cliente B', descripcion: 'x' });
    expect(s.asesor).toBeNull();
  });

  it('un asesor crea la solicitud y queda asignada a él', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Cliente C', descripcion: 'x' });
    expect(s.asesor).toBe('asesor1');
  });

  it('Escenario 01: un supervisor asigna a un asesor existente y se guarda el evento ASIGNACION', async () => {
    const s = await crear(api, 'supervisor1', { cliente: 'Cliente D', descripcion: 'x' });

    const res = await api('supervisor1')
      .patch(`/solicitudes/${s.id}/asignacion`)
      .send({ asesorId: 'asesor2' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.asesor).toBe('asesor2');

    const historial = await api('admin1').get(`/solicitudes/${s.id}/historial`);
    const evento = historial.body.data.find((e: { tipoEvento: string }) => e.tipoEvento === 'ASIGNACION');
    expect(evento).toMatchObject({
      solicitudId: s.id,
      valorAnterior: null,
      valorNuevo: 'asesor2',
      usuarioActor: 'supervisor1',
    });
    expect(new Date(evento.fechaEvento).toString()).not.toBe('Invalid Date');
  });

  it('Escenario 02: asignar a un usuario inexistente, supervisor o admin -> 400 y sin cambios', async () => {
    const s = await crear(api, 'supervisor1', { cliente: 'Cliente E', descripcion: 'x' });

    for (const asesorId of ['no-existe', 'supervisor1', 'admin1']) {
      const res = await api('supervisor1')
        .patch(`/solicitudes/${s.id}/asignacion`)
        .send({ asesorId });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }

    const sigue = await api('admin1').get(`/solicitudes/${s.id}`);
    expect(sigue.body.data.asesor).toBeNull();
    const historial = await api('admin1').get(`/solicitudes/${s.id}/historial`);
    expect(historial.body.data).toHaveLength(1); // solo la creación
  });

  it('asesorId faltante, vacío o con propiedades extra -> 400', async () => {
    const s = await crear(api, 'supervisor1', { cliente: 'Cliente F', descripcion: 'x' });
    const url = `/solicitudes/${s.id}/asignacion`;
    expect((await api('supervisor1').patch(url).send({})).status).toBe(400);
    expect((await api('supervisor1').patch(url).send({ asesorId: '' })).status).toBe(400);
    expect((await api('supervisor1').patch(url).send({ asesorId: 5 })).status).toBe(400);
    expect(
      (await api('supervisor1').patch(url).send({ asesorId: 'asesor1', estado: 'RESUELTA' })).status,
    ).toBe(400);
  });

  it('Escenario 03: un asesor intenta asignar o reasignar -> 403', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Cliente G', descripcion: 'x' });

    const reasignar = await api('asesor1')
      .patch(`/solicitudes/${s.id}/asignacion`)
      .send({ asesorId: 'asesor2' });
    expect(reasignar.status).toBe(403);
    expect(reasignar.body.statusCode).toBe(403);

    const sigue = await api('admin1').get(`/solicitudes/${s.id}`);
    expect(sigue.body.data.asesor).toBe('asesor1');
  });

  it('asignar una solicitud que no existe -> 404', async () => {
    const res = await api('supervisor1')
      .patch('/solicitudes/9999/asignacion')
      .send({ asesorId: 'asesor1' });
    expect(res.status).toBe(404);
  });

  it('sin x-api-key o con usuario inexistente -> 401 también en la asignación', async () => {
    expect(
      (await api('supervisor1', null).patch('/solicitudes/1/asignacion').send({ asesorId: 'asesor1' })).status,
    ).toBe(401);
    expect(
      (await api('hacker').patch('/solicitudes/1/asignacion').send({ asesorId: 'asesor1' })).status,
    ).toBe(401);
  });

  it('reasignar no cambia el estado y genera un evento con valor anterior y nuevo', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Cliente H', descripcion: 'x' });
    await cambiarEstado(api, 'supervisor1', s.id, 'EN_GESTION');

    const res = await api('admin1')
      .patch(`/solicitudes/${s.id}/asignacion`)
      .send({ asesorId: 'asesor2' });
    expect(res.status).toBe(200);
    expect(res.body.data.asesor).toBe('asesor2');
    expect(res.body.data.estado).toBe('EN_GESTION'); // el estado no cambió

    const historial = await api('admin1').get(`/solicitudes/${s.id}/historial`);
    const eventos = historial.body.data;
    expect(eventos.map((e: { tipoEvento: string }) => e.tipoEvento)).toEqual([
      'CREACION',
      'ESTADO',
      'ASIGNACION',
    ]);
    expect(eventos[2]).toMatchObject({
      valorAnterior: 'asesor1',
      valorNuevo: 'asesor2',
      usuarioActor: 'admin1',
    });
  });

  it('asignar al mismo asesor que ya tiene -> 409 y no se guarda un evento vacío', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Cliente I', descripcion: 'x' });
    const res = await api('supervisor1')
      .patch(`/solicitudes/${s.id}/asignacion`)
      .send({ asesorId: 'asesor1' });
    expect(res.status).toBe(409);

    const historial = await api('admin1').get(`/solicitudes/${s.id}/historial`);
    expect(historial.body.data).toHaveLength(1);
  });

  it('Escenario 04: reasignar una solicitud RESUELTA -> 409 y sin cambios', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Cliente J', descripcion: 'x' });
    await cambiarEstado(api, 'supervisor1', s.id, 'EN_GESTION');
    await cambiarEstado(api, 'supervisor1', s.id, 'RESUELTA');

    const res = await api('supervisor1')
      .patch(`/solicitudes/${s.id}/asignacion`)
      .send({ asesorId: 'asesor2' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ success: false, statusCode: 409 });
    expect(res.body.timestamp).toBeDefined();

    const sigue = await api('admin1').get(`/solicitudes/${s.id}`);
    expect(sigue.body.data.asesor).toBe('asesor1');
    expect(sigue.body.data.estado).toBe('RESUELTA');
  });
});

describe('RN-08 Filtros y paginación', () => {
  let app: INestApplication;
  let api: Api;

  beforeAll(async () => {
    app = await crearApp();
    api = crearCliente(app);

    // Datos de prueba:
    //  1 Ferretería El Norte  asesor1  PENDIENTE
    //  2 Ferretería Norte Dos asesor1  EN_GESTION
    //  3 Tienda Sur           asesor2  PENDIENTE
    //  4 Panadería La Esquina asesor2  RESUELTA
    //  5 Cliente sin asesor   (sin asignar) PENDIENTE
    await crear(api, 'asesor1', { cliente: 'Ferretería El Norte', descripcion: 'x' });
    const dos = await crear(api, 'asesor1', { cliente: 'Ferretería Norte Dos', descripcion: 'x' });
    await cambiarEstado(api, 'supervisor1', dos.id, 'EN_GESTION');
    await crear(api, 'asesor2', { cliente: 'Tienda Sur', descripcion: 'x' });
    const cuatro = await crear(api, 'asesor2', { cliente: 'Panadería La Esquina', descripcion: 'x' });
    await cambiarEstado(api, 'supervisor1', cuatro.id, 'EN_GESTION');
    await cambiarEstado(api, 'supervisor1', cuatro.id, 'RESUELTA');
    await crear(api, 'supervisor1', { cliente: 'Cliente sin asesor', descripcion: 'x' });
  });
  afterAll(async () => {
    await app.close();
  });

  const clientes = (res: { body: { data: { items: { cliente: string }[] } } }) =>
    res.body.data.items.map((s) => s.cliente);

  it('Sin parámetros usa page=1 y limit=10 y devuelve { items, pagination }', async () => {
    const res = await api('admin1').get('/solicitudes');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.items).toHaveLength(5);
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 10, total: 5, totalPages: 1 });
  });

  it('Pagina en la base de datos: límite, páginas y totalPages', async () => {
    const p1 = await api('admin1').get('/solicitudes?limit=2&page=1');
    expect(p1.body.data.items).toHaveLength(2);
    expect(p1.body.data.pagination).toEqual({ page: 1, limit: 2, total: 5, totalPages: 3 });

    const p3 = await api('admin1').get('/solicitudes?limit=2&page=3');
    expect(p3.body.data.items).toHaveLength(1);

    const fuera = await api('admin1').get('/solicitudes?limit=2&page=9');
    expect(fuera.status).toBe(200);
    expect(fuera.body.data.items).toHaveLength(0);
    expect(fuera.body.data.pagination.total).toBe(5);

    // Las páginas no se repiten ni se saltan solicitudes
    const p2 = await api('admin1').get('/solicitudes?limit=2&page=2');
    const ids = [...p1.body.data.items, ...p2.body.data.items, ...p3.body.data.items].map(
      (s: { id: number }) => s.id,
    );
    expect(new Set(ids).size).toBe(5);
  });

  it('Sin resultados: lista vacía y totalPages 0', async () => {
    const res = await api('admin1').get('/solicitudes?cliente=zzzz');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
  });

  it('Filtro por estado', async () => {
    const res = await api('supervisor1').get('/solicitudes?estado=PENDIENTE');
    expect(res.body.data.pagination.total).toBe(3);
    expect(res.body.data.items.every((s: { estado: string }) => s.estado === 'PENDIENTE')).toBe(true);
  });

  it('Filtro por asesor', async () => {
    const res = await api('admin1').get('/solicitudes?asesor=asesor2');
    expect(clientes(res).sort()).toEqual(['Panadería La Esquina', 'Tienda Sur']);
  });

  it('Filtro por cliente: búsqueda parcial sin distinguir mayúsculas', async () => {
    const res = await api('admin1').get('/solicitudes?cliente=NORTE');
    expect(clientes(res)).toEqual(['Ferretería El Norte', 'Ferretería Norte Dos']);
  });

  it('Filtro por fechas (desde, hasta y ambos) sobre creadaEn', async () => {
    const ayer = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const manana = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const desdeAyer = await api('admin1').get(`/solicitudes?desde=${ayer}`);
    expect(desdeAyer.body.data.pagination.total).toBe(5);

    const desdeManana = await api('admin1').get(`/solicitudes?desde=${manana}`);
    expect(desdeManana.body.data.pagination.total).toBe(0);

    const hastaAyer = await api('admin1').get(`/solicitudes?hasta=${ayer}`);
    expect(hastaAyer.body.data.pagination.total).toBe(0);

    const hastaManana = await api('admin1').get(`/solicitudes?hasta=${manana}`);
    expect(hastaManana.body.data.pagination.total).toBe(5);

    const rango = await api('admin1').get(`/solicitudes?desde=${ayer}&hasta=${manana}`);
    expect(rango.body.data.pagination.total).toBe(5);
  });

  it('Filtros combinados (estado + asesor + cliente + fechas + paginación)', async () => {
    const ayer = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const manana = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const res = await api('supervisor1').get(
      `/solicitudes?estado=EN_GESTION&asesor=asesor1&cliente=norte&desde=${ayer}&hasta=${manana}&page=1&limit=5`,
    );
    expect(res.status).toBe(200);
    expect(clientes(res)).toEqual(['Ferretería Norte Dos']);
    expect(res.body.data.pagination).toEqual({ page: 1, limit: 5, total: 1, totalPages: 1 });

    // Si un filtro no coincide, el resultado queda vacío
    const ninguno = await api('supervisor1').get(
      '/solicitudes?estado=RESUELTA&asesor=asesor1&cliente=norte',
    );
    expect(ninguno.body.data.items).toHaveLength(0);
  });

  it('Escenario 05: un asesor con asesor=otro_usuario solo recibe sus propias solicitudes', async () => {
    const res = await api('asesor1').get('/solicitudes?asesor=asesor2');
    expect(res.status).toBe(200);
    expect(clientes(res)).toEqual(['Ferretería El Norte', 'Ferretería Norte Dos']);
    expect(res.body.data.items.every((s: { asesor: string }) => s.asesor === 'asesor1')).toBe(true);
    expect(res.body.data.pagination.total).toBe(2);
  });

  it('un asesor no ve solicitudes sin asignar ni ajenas con otros filtros', async () => {
    const sinAsignar = await api('asesor1').get('/solicitudes?cliente=sin asesor');
    expect(sinAsignar.body.data.items).toHaveLength(0);

    const ajenas = await api('asesor1').get('/solicitudes?estado=RESUELTA');
    expect(ajenas.body.data.items).toHaveLength(0);
  });

  it('un asesor usa los filtros dentro de lo suyo', async () => {
    const res = await api('asesor1').get('/solicitudes?estado=EN_GESTION');
    expect(clientes(res)).toEqual(['Ferretería Norte Dos']);
  });

  it('Escenario 06: page=0, limit=-1, limit=1000 y texto en números -> 400', async () => {
    const invalidas = [
      'page=0',
      'page=-1',
      'page=abc',
      'page=1.5',
      'limit=-1',
      'limit=0',
      'limit=1000',
      'limit=101',
      'limit=abc',
    ];
    for (const q of invalidas) {
      const res = await api('admin1').get(`/solicitudes?${q}`);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    }
    // El máximo permitido sí funciona
    expect((await api('admin1').get('/solicitudes?limit=100')).status).toBe(200);
  });

  it('estado no permitido, fechas inválidas y parámetros desconocidos -> 400', async () => {
    for (const q of ['estado=CANCELADA', 'desde=hoy', 'hasta=2026-13-45', 'foo=bar']) {
      const res = await api('admin1').get(`/solicitudes?${q}`);
      expect(res.status).toBe(400);
    }
  });

  it('Escenario 07: desde posterior a hasta -> 400', async () => {
    const res = await api('admin1').get(
      '/solicitudes?desde=2026-10-31T00:00:00Z&hasta=2026-10-01T00:00:00Z',
    );
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('desde');
  });

  it('el filtro sigue protegido por x-api-key y x-user', async () => {
    expect((await api('admin1', null).get('/solicitudes?limit=5')).status).toBe(401);
    expect((await api('hacker').get('/solicitudes?limit=5')).status).toBe(401);
  });
});

describe('RN-09 Historial', () => {
  let app: INestApplication;
  let api: Api;

  beforeAll(async () => {
    app = await crearApp();
    api = crearCliente(app);
  });
  afterAll(async () => {
    await app.close();
  });

  it('registra CREACION, ESTADO y ASIGNACION en orden, con actor, valores y fecha', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Historial 1', descripcion: 'x' });
    await cambiarEstado(api, 'asesor1', s.id, 'EN_GESTION');
    await api('supervisor1').patch(`/solicitudes/${s.id}/asignacion`).send({ asesorId: 'asesor2' });
    await cambiarEstado(api, 'admin1', s.id, 'RESUELTA');

    const res = await api('admin1').get(`/solicitudes/${s.id}/historial`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const eventos = res.body.data;
    expect(eventos).toHaveLength(4);
    expect(eventos.map((e: { tipoEvento: string }) => e.tipoEvento)).toEqual([
      'CREACION',
      'ESTADO',
      'ASIGNACION',
      'ESTADO',
    ]);
    expect(eventos[0]).toMatchObject({ valorAnterior: null, valorNuevo: 'PENDIENTE', usuarioActor: 'asesor1' });
    expect(eventos[1]).toMatchObject({ valorAnterior: 'PENDIENTE', valorNuevo: 'EN_GESTION', usuarioActor: 'asesor1' });
    expect(eventos[2]).toMatchObject({ valorAnterior: 'asesor1', valorNuevo: 'asesor2', usuarioActor: 'supervisor1' });
    expect(eventos[3]).toMatchObject({ valorAnterior: 'EN_GESTION', valorNuevo: 'RESUELTA', usuarioActor: 'admin1' });

    for (const evento of eventos) {
      expect(evento.id).toBeDefined();
      expect(evento.solicitudId).toBe(s.id);
      expect(new Date(evento.fechaEvento).toString()).not.toBe('Invalid Date');
    }
  });

  it('el usuario actor sale del x-user, no del cuerpo (un campo "usuarioActor" se rechaza)', async () => {
    const res = await api('asesor1')
      .post('/solicitudes')
      .send({ cliente: 'X', descripcion: 'Y', usuarioActor: 'admin1' });
    expect(res.status).toBe(400);
  });

  it('un cambio de estado inválido no genera evento', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Historial 2', descripcion: 'x' });
    const res = await api('asesor1').patch(`/solicitudes/${s.id}/estado`).send({ estado: 'RESUELTA' });
    expect(res.status).toBe(400);

    const historial = await api('admin1').get(`/solicitudes/${s.id}/historial`);
    expect(historial.body.data).toHaveLength(1);
  });

  it('un asesor consulta el historial de una solicitud asignada a él', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Historial 3', descripcion: 'x' });
    const res = await api('asesor1').get(`/solicitudes/${s.id}/historial`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('Escenario 11: un asesor no puede consultar el historial de una solicitud ajena -> 404', async () => {
    const s = await crear(api, 'asesor2', { cliente: 'Historial 4', descripcion: 'x' });
    const res = await api('asesor1').get(`/solicitudes/${s.id}/historial`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    // Una solicitud sin asignar tampoco es visible para un asesor
    const sinAsignar = await crear(api, 'supervisor1', { cliente: 'Historial 5', descripcion: 'x' });
    expect((await api('asesor1').get(`/solicitudes/${sinAsignar.id}/historial`)).status).toBe(404);
  });

  it('si la solicitud se reasigna, el asesor anterior pierde el acceso al historial', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Historial 6', descripcion: 'x' });
    await api('supervisor1').patch(`/solicitudes/${s.id}/asignacion`).send({ asesorId: 'asesor2' });

    expect((await api('asesor1').get(`/solicitudes/${s.id}/historial`)).status).toBe(404);
    expect((await api('asesor2').get(`/solicitudes/${s.id}/historial`)).status).toBe(200);
  });

  it('historial de una solicitud inexistente -> 404 y id inválido -> 400', async () => {
    expect((await api('admin1').get('/solicitudes/9999/historial')).status).toBe(404);
    expect((await api('admin1').get('/solicitudes/abc/historial')).status).toBe(400);
  });

  it('el historial exige x-api-key y x-user', async () => {
    expect((await api('admin1', null).get('/solicitudes/1/historial')).status).toBe(401);
    expect((await api().get('/solicitudes/1/historial')).status).toBe(401);
  });

  it('No existen endpoints para crear, editar o borrar eventos', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Historial 7', descripcion: 'x' });
    const rutas = [`/solicitudes/${s.id}/historial`, '/historial', '/historial/1', `/solicitudes/${s.id}/historial/1`];

    for (const ruta of rutas) {
      for (const metodo of ['post', 'put', 'patch', 'delete'] as const) {
        const res = await api('admin1')[metodo](ruta).send({ valorNuevo: 'hack' });
        expect(res.status).toBe(404);
      }
    }
  });
});

describe('RN-09 Transacciones: si falla el historial, se revierte todo', () => {
  let app: INestApplication;
  let api: Api;

  beforeAll(async () => {
    app = await crearApp();
    api = crearCliente(app);
  });
  afterAll(async () => {
    await app.close();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Hace fallar SOLO el guardado de eventos de historial. La solicitud se guarda
  // primero y el historial después, así que la prueba demuestra que el rollback
  // deshace también el primer guardado.
  function fallarAlGuardarHistorial() {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined); // evita ruido en consola
    const guardarOriginal = EntityManager.prototype.save;
    jest
      .spyOn(EntityManager.prototype, 'save')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation(function (this: EntityManager, ...args: any[]) {
        if (args[0] instanceof SolicitudHistorial) {
          throw new Error('Fallo simulado al guardar el historial');
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (guardarOriginal as any).apply(this, args);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
  }

  it('Escenario 10: un fallo del historial en un cambio de estado revierte el estado', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Rollback 1', descripcion: 'x' });

    fallarAlGuardarHistorial();
    const res = await api('supervisor1').patch(`/solicitudes/${s.id}/estado`).send({ estado: 'EN_GESTION' });
    jest.restoreAllMocks();

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ success: false, statusCode: 500 });

    const sigue = await api('admin1').get(`/solicitudes/${s.id}`);
    expect(sigue.body.data.estado).toBe('PENDIENTE'); // el cambio no quedó aplicado
    const historial = await api('admin1').get(`/solicitudes/${s.id}/historial`);
    expect(historial.body.data).toHaveLength(1); // solo CREACION
  });

  it('un fallo del historial en una asignación revierte la asignación', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Rollback 2', descripcion: 'x' });

    fallarAlGuardarHistorial();
    const res = await api('supervisor1')
      .patch(`/solicitudes/${s.id}/asignacion`)
      .send({ asesorId: 'asesor2' });
    jest.restoreAllMocks();

    expect(res.status).toBe(500);
    const sigue = await api('admin1').get(`/solicitudes/${s.id}`);
    expect(sigue.body.data.asesor).toBe('asesor1');
    const historial = await api('admin1').get(`/solicitudes/${s.id}/historial`);
    expect(historial.body.data).toHaveLength(1);
  });

  it('un fallo del historial al crear no deja la solicitud guardada', async () => {
    const antes = await api('admin1').get('/solicitudes');

    fallarAlGuardarHistorial();
    const res = await api('asesor1').post('/solicitudes').send({ cliente: 'Rollback 3', descripcion: 'x' });
    jest.restoreAllMocks();

    expect(res.status).toBe(500);
    const despues = await api('admin1').get('/solicitudes');
    expect(despues.body.data.pagination.total).toBe(antes.body.data.pagination.total);
  });

  it('tras el fallo la API sigue funcionando con normalidad', async () => {
    const s = await crear(api, 'asesor1', { cliente: 'Rollback 4', descripcion: 'x' });
    await cambiarEstado(api, 'supervisor1', s.id, 'EN_GESTION');
    const historial = await api('admin1').get(`/solicitudes/${s.id}/historial`);
    expect(historial.body.data).toHaveLength(2);
  });
});
