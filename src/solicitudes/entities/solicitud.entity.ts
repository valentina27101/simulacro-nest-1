import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
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

  // Guarda el username del asesor responsable (ej: asesor1).
  @ApiProperty({ example: 'asesor1' })
  @Column()
  asesor: string;

  @ApiProperty({
    enum: EstadoSolicitud,
    example: EstadoSolicitud.PENDIENTE,
  })
  @Column({
    type: 'simple-enum',
    enum: EstadoSolicitud,
    default: EstadoSolicitud.PENDIENTE,
  })
  estado: EstadoSolicitud;

  // TypeORM llena esta fecha sola al insertar.
  @ApiProperty({ example: '2026-10-12T15:30:00.000Z' })
  @CreateDateColumn()
  creadaEn: Date;

  // TypeORM actualiza esta fecha sola en cada modificación.
  @ApiProperty({ example: '2026-10-12T15:30:00.000Z' })
  @UpdateDateColumn()
  actualizadaEn: Date;
}
