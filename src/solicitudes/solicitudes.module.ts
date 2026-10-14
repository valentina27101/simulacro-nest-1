import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { SolicitudHistorial } from './entities/solicitud-historial.entity';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudesController } from './solicitudes.controller';
import { SolicitudesService } from './solicitudes.service';

@Module({
  // UsersModule: el servicio valida que el asesor asignado exista y tenga ese rol.
  imports: [TypeOrmModule.forFeature([Solicitud, SolicitudHistorial]), UsersModule],
  controllers: [SolicitudesController],
  providers: [SolicitudesService],
})
export class SolicitudesModule {}
