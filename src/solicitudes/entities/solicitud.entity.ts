import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum EstadoSolicitud {
  PENDIENTE = 'PENDIENTE',
  EN_GESTION = 'EN_GESTION',
  RESUELTA = 'RESUELTA',
}

@Entity('solicitudes')
export class Solicitud {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Empresa ABC S.A.S.' })
  @Column()
  cliente: string;

  @ApiProperty({ example: 'El cliente pide una cotización de 50 licencias' })
  @Column()
  descripcion: string;

  // Username del asesor asignado (ej: asesor1). Es null mientras un admin o
  // supervisor no la asigne. Se indexa porque se usa para filtrar y por permisos.
  @ApiProperty({
    example: 'asesor1',
    nullable: true,
    description: 'Asesor asignado; null si todavía no tiene asignación',
  })
  @Index()
  @Column({ type: 'varchar', nullable: true })
  asesor: string | null;

  @ApiProperty({
    enum: EstadoSolicitud,
    example: EstadoSolicitud.PENDIENTE,
  })
  @Index()
  @Column({
    type: 'simple-enum',
    enum: EstadoSolicitud,
    default: EstadoSolicitud.PENDIENTE,
  })
  estado: EstadoSolicitud;

  // TypeORM llena esta fecha sola al insertar.
  @ApiProperty({ example: '2026-10-12T15:30:00.000Z' })
  @Index()
  @CreateDateColumn()
  creadaEn: Date;

  // TypeORM actualiza esta fecha sola en cada modificación.
  @ApiProperty({ example: '2026-10-12T15:30:00.000Z' })
  @UpdateDateColumn()
  actualizadaEn: Date;
}
