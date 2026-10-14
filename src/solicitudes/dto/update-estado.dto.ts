import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoSolicitud } from '../entities/solicitud.entity';

// Este endpoint solo permite cambiar el estado, ningún otro campo.
export class UpdateEstadoDto {
  @ApiProperty({
    description: 'Nuevo estado de la solicitud',
    enum: EstadoSolicitud,
    example: EstadoSolicitud.EN_GESTION,
  })
  @IsEnum(EstadoSolicitud, {
    message: 'estado debe ser PENDIENTE, EN_GESTION o RESUELTA',
  })
  estado: EstadoSolicitud;
}
