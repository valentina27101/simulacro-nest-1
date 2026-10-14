import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { EstadoSolicitud } from '../entities/solicitud.entity';

// Parámetros de GET /solicitudes. Todos son opcionales.
// El ValidationPipe global convierte page y limit a número (@Type) y
// rechaza valores como page=0, limit=-1, limit=1000 o texto.
export class ListarSolicitudesQueryDto {
  @ApiPropertyOptional({ enum: EstadoSolicitud, example: 'EN_GESTION' })
  @IsOptional()
  @IsEnum(EstadoSolicitud, {
    message: 'estado debe ser PENDIENTE, EN_GESTION o RESUELTA',
  })
  estado?: EstadoSolicitud;

  @ApiPropertyOptional({
    description: 'Username del asesor asignado. Un asesor siempre ve solo lo suyo.',
    example: 'asesor1',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'asesor no puede estar vacío' })
  asesor?: string;

  @ApiPropertyOptional({
    description: 'Búsqueda parcial por nombre del cliente (sin distinguir mayúsculas)',
    example: 'norte',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'cliente no puede estar vacío' })
  cliente?: string;

  @ApiPropertyOptional({
    description: 'Fecha inicial de creación (ISO 8601)',
    example: '2026-10-01T00:00:00Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'desde debe ser una fecha ISO 8601 válida' })
  desde?: string;

  @ApiPropertyOptional({
    description: 'Fecha final de creación (ISO 8601)',
    example: '2026-10-31T23:59:59Z',
  })
  @IsOptional()
  @IsISO8601({ strict: true }, { message: 'hasta debe ser una fecha ISO 8601 válida' })
  hasta?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un número entero' })
  @Min(1, { message: 'page debe ser mayor o igual a 1' })
  page: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 10, example: 10 })
  @Type(() => Number)
  @IsInt({ message: 'limit debe ser un número entero' })
  @Min(1, { message: 'limit debe ser mayor o igual a 1' })
  @Max(100, { message: 'limit no puede ser mayor a 100' })
  limit: number = 10;
}
