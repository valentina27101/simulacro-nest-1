import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';
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
  ) {}

  // RN-01: el estado inicial siempre es PENDIENTE y el asesor es quien registra.
  // Si el usuario es admin o supervisor, queda como responsable él mismo
  // (el documento no define cómo asignar a otro asesor).
  async crear(
    dto: CreateSolicitudDto,
    usuario: AuthenticatedUser,
  ): Promise<Solicitud> {
    const solicitud = this.solicitudesRepository.create({
      cliente: dto.cliente,
      descripcion: dto.descripcion,
      asesor: usuario.username,
      estado: EstadoSolicitud.PENDIENTE,
    });
    return this.solicitudesRepository.save(solicitud);
  }

  // RN-02: el filtro del asesor va dentro del WHERE de la consulta SQL.
  async listar(usuario: AuthenticatedUser): Promise<Solicitud[]> {
    return this.solicitudesRepository.find({
      where: this.filtroPorRol(usuario),
      order: { id: 'ASC' },
    });
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

  // solo PENDIENTE -> EN_GESTION y EN_GESTION -> RESUELTA.
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

    solicitud.estado = dto.estado;
    return this.solicitudesRepository.save(solicitud);
  }

  // Admin y supervisor ven todo (sin filtro); el asesor solo lo suyo.
  private filtroPorRol(usuario: AuthenticatedUser): { asesor?: string } {
    return usuario.rol === 'asesor' ? { asesor: usuario.username } : {};
  }
}
