import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Solicitud } from './solicitud.entity';

export enum TipoEvento {
  CREACION = 'CREACION',
  ESTADO = 'ESTADO',
  ASIGNACION = 'ASIGNACION',
}

// Cada fila es un cambio hecho a una solicitud. Solo se inserta desde el
// servicio de solicitudes: no hay endpoints para crear, editar o borrar eventos.
@Entity('solicitud_historial')
export class SolicitudHistorial {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 15 })
  @Index()
  @Column()
  solicitudId: number;

  @ManyToOne(() => Solicitud, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solicitudId' })
  solicitud: Solicitud;

  @ApiProperty({ enum: TipoEvento, example: TipoEvento.ASIGNACION })
  @Column({ type: 'simple-enum', enum: TipoEvento })
  tipoEvento: TipoEvento;

  @ApiProperty({
    example: 'asesor1',
    nullable: true,
    description: 'Valor antes del cambio; null cuando no había (ej: creación)',
  })
  @Column({ type: 'varchar', nullable: true })
  valorAnterior: string | null;

  @ApiProperty({ example: 'asesor2' })
  @Column()
  valorNuevo: string;

  @ApiProperty({
    example: 'supervisor1',
    description: 'Usuario (x-user) que ejecutó la acción',
  })
  @Column()
  usuarioActor: string;

  @ApiProperty({ example: '2026-10-12T15:30:00.000Z' })
  @CreateDateColumn()
  fechaEvento: Date;
}
