import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  DataSource,
  FindOptionsWhere,
  LessThanOrEqual,
  Like,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { UsersService } from '../users/users.service';
import { AsignarSolicitudDto } from './dto/asignar-solicitud.dto';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { ListarSolicitudesQueryDto } from './dto/listar-solicitudes-query.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';
import { SolicitudHistorial, TipoEvento } from './entities/solicitud-historial.entity';
import { EstadoSolicitud, Solicitud } from './entities/solicitud.entity';

// Para cada estado, el único estado al que se puede pasar.
// RESUELTA no tiene siguiente: una solicitud resuelta no se puede reabrir.
const SIGUIENTE_ESTADO: Record<EstadoSolicitud, EstadoSolicitud | null> = {
  [EstadoSolicitud.PENDIENTE]: EstadoSolicitud.EN_GESTION,
  [EstadoSolicitud.EN_GESTION]: EstadoSolicitud.RESUELTA,
  [EstadoSolicitud.RESUELTA]: null,
};

@Injectable()
export class SolicitudesService {
  constructor(
    @InjectRepository(Solicitud)
    private readonly solicitudesRepository: Repository<Solicitud>,
    @InjectRepository(SolicitudHistorial)
    private readonly historialRepository: Repository<SolicitudHistorial>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
  ) {}

  // RN-01 y RN-07: el estado inicial siempre es PENDIENTE. Si crea un asesor,
  // queda asignada a él; si crea un admin o supervisor, queda sin asignar.
  async crear(
    dto: CreateSolicitudDto,
    usuario: AuthenticatedUser,
  ): Promise<Solicitud> {
    const solicitud = this.solicitudesRepository.create({
      cliente: dto.cliente,
      descripcion: dto.descripcion,
      asesor: usuario.rol === 'asesor' ? usuario.username : null,
      estado: EstadoSolicitud.PENDIENTE,
    });

    return this.guardarConHistorial(
      solicitud,
      { tipoEvento: TipoEvento.CREACION, valorAnterior: null, valorNuevo: EstadoSolicitud.PENDIENTE },
      usuario,
    );
  }

  // RN-02 y RN-08: filtros + paginación + permisos, todo dentro de la consulta SQL.
  async listar(query: ListarSolicitudesQueryDto, usuario: AuthenticatedUser) {
    const { estado, asesor, cliente, desde, hasta, page, limit } = query;

    if (desde && hasta && new Date(desde) > new Date(hasta)) {
      throw new BadRequestException('La fecha "desde" no puede ser posterior a "hasta"');
    }

    const where: FindOptionsWhere<Solicitud> = {};
    if (estado) where.estado = estado;
    if (asesor) where.asesor = asesor;
    // Va después del filtro "asesor" a propósito: si el usuario es asesor,
    // pisa lo que haya enviado y solo puede ver lo que tiene asignado.
    Object.assign(where, this.filtroPorRol(usuario));
    // LIKE en SQLite no distingue mayúsculas de minúsculas (para letras ASCII).
    if (cliente) where.cliente = Like(`%${cliente}%`);
    if (desde && hasta) {
      where.creadaEn = Between(new Date(desde), new Date(hasta));
    } else if (desde) {
      where.creadaEn = MoreThanOrEqual(new Date(desde));
    } else if (hasta) {
      where.creadaEn = LessThanOrEqual(new Date(hasta));
    }

    // findAndCount hace un SELECT con LIMIT/OFFSET y un COUNT con el mismo WHERE.
    const [items, total] = await this.solicitudesRepository.findAndCount({
      where,
      order: { id: 'ASC' }, // orden fijo para que las páginas sean estables
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  // Misma restricción que la lista: si el asesor no es el dueño, no la encuentra.
  // Se responde 404 (y no 403) para no confirmar que ese id existe.
  async buscarPorId(id: number, usuario: AuthenticatedUser): Promise<Solicitud> {
    const solicitud = await this.solicitudesRepository.findOne({
      where: { id, ...this.filtroPorRol(usuario) },
    });

    if (!solicitud) {
      throw new NotFoundException(
        `La solicitud ${id} no existe o no tienes acceso a ella`,
      );
    }
    return solicitud;
  }

  // RN-03: solo PENDIENTE -> EN_GESTION y EN_GESTION -> RESUELTA.
  async cambiarEstado(
    id: number,
    dto: UpdateEstadoDto,
    usuario: AuthenticatedUser,
  ): Promise<Solicitud> {
    // Si es asesor y la solicitud es ajena, aquí ya falla con 404.
    const solicitud = await this.buscarPorId(id, usuario);

    if (SIGUIENTE_ESTADO[solicitud.estado] !== dto.estado) {
      throw new BadRequestException(
        `No se puede cambiar una solicitud de ${solicitud.estado} a ${dto.estado}`,
      );
    }

    const estadoAnterior = solicitud.estado;
    solicitud.estado = dto.estado;
    return this.guardarConHistorial(
      solicitud,
      { tipoEvento: TipoEvento.ESTADO, valorAnterior: estadoAnterior, valorNuevo: dto.estado },
      usuario,
    );
  }

  // RN-07: asignar o reasignar. Solo admin y supervisor llegan hasta aquí
  // (lo controla @Roles en el controlador). No cambia el estado.
  async asignar(
    id: number,
    dto: AsignarSolicitudDto,
    usuario: AuthenticatedUser,
  ): Promise<Solicitud> {
    const solicitud = await this.buscarPorId(id, usuario);

    // El asesor debe existir en el catálogo y tener exactamente el rol "asesor".
    const asesor = this.usersService.findByUsername(dto.asesorId);
    if (!asesor || asesor.rol !== 'asesor') {
      throw new BadRequestException(
        `"${dto.asesorId}" no es un asesor válido (debe existir y tener rol asesor)`,
      );
    }

    if (solicitud.estado === EstadoSolicitud.RESUELTA) {
      throw new ConflictException('Una solicitud RESUELTA no puede reasignarse');
    }

    // Asignar al mismo asesor no cambia nada, así que no se guarda un evento vacío.
    if (solicitud.asesor === asesor.username) {
      throw new ConflictException(
        `La solicitud ya está asignada a ${asesor.username}`,
      );
    }

    const asesorAnterior = solicitud.asesor;
    solicitud.asesor = asesor.username;
    return this.guardarConHistorial(
      solicitud,
      { tipoEvento: TipoEvento.ASIGNACION, valorAnterior: asesorAnterior, valorNuevo: asesor.username },
      usuario,
    );
  }

  // RN-09: historial de una solicitud, del evento más antiguo al más reciente.
  async obtenerHistorial(
    id: number,
    usuario: AuthenticatedUser,
  ): Promise<SolicitudHistorial[]> {
    // Primero se valida el acceso: un asesor solo ve el historial de lo que
    // tiene asignado actualmente (si no, 404 como en GET /solicitudes/:id).
    await this.buscarPorId(id, usuario);

    // SQLite guarda la fecha en segundos, por eso se desempata con el id.
    return this.historialRepository.find({
      where: { solicitudId: id },
      order: { fechaEvento: 'ASC', id: 'ASC' },
    });
  }

  // Guarda la solicitud y su evento de historial en UNA transacción:
  // si falla cualquiera de los dos, TypeORM revierte ambos.
  private guardarConHistorial(
    solicitud: Solicitud,
    evento: Pick<SolicitudHistorial, 'tipoEvento' | 'valorAnterior' | 'valorNuevo'>,
    usuario: AuthenticatedUser,
  ): Promise<Solicitud> {
    return this.dataSource.transaction(async (manager) => {
      const guardada = await manager.save(solicitud);

      // El usuario actor sale del x-user ya validado, nunca del cuerpo.
      await manager.save(
        manager.create(SolicitudHistorial, {
          solicitudId: guardada.id,
          ...evento,
          usuarioActor: usuario.username,
        }),
      );

      return guardada;
    });
  }

  // Admin y supervisor ven todo (sin filtro); el asesor solo lo suyo.
  private filtroPorRol(usuario: AuthenticatedUser): { asesor?: string } {
    return usuario.rol === 'asesor' ? { asesor: usuario.username } : {};
  }
}
