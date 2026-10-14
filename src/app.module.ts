import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { UserGuard } from './common/guards/user.guard';
import configuration from './config/configuration';
import { SolicitudesModule } from './solicitudes/solicitudes.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    // Carga el archivo .env y deja la configuración disponible en toda la app.
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        // SQLite mediante el driver better-sqlite3 (el que usa TypeORM 1.x).
        type: 'better-sqlite3' as const,
        database: config.getOrThrow<string>('database.path'),
        autoLoadEntities: true,
        // Crea las tablas automáticamente. Es cómodo para esta prueba;
        // en producción se usarían migraciones.
        synchronize: true,
      }),
    }),
    UsersModule,
    SolicitudesModule,
  ],
  providers: [
    // Guards globales: cubren TODOS los endpoints y se ejecutan en este orden:
    // 1) API Key, 2) usuario, 3) rol.
    { provide: APP_GUARD, useClass: ApiKeyGuard },
    { provide: APP_GUARD, useClass: UserGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
