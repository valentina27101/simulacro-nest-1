import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { AsignarSolicitudDto } from './dto/asignar-solicitud.dto';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { ListarSolicitudesQueryDto } from './dto/listar-solicitudes-query.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';
import { SolicitudHistorial } from './entities/solicitud-historial.entity';
import { Solicitud } from './entities/solicitud.entity';
import { SolicitudesService } from './solicitudes.service';

@ApiTags('Solicitudes')
@ApiExtraModels(Solicitud, SolicitudHistorial)
@ApiSecurity('x-api-key')
@ApiHeader({
  name: 'x-user',
  required: true,
  description:
    'Usuario de prueba: admin1, supervisor1, asesor1 o asesor2',
  example: 'asesor1',
})
@ApiUnauthorizedResponse({
  description: 'Falta x-api-key o x-user, o alguno no es válido',
})
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  @Post()
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Registrar una solicitud',
    description:
      'Crea una solicitud en estado PENDIENTE y registra el evento CREACION en el historial. ' +
      'Si la crea un asesor, queda asignada a él. Si la crea un admin o supervisor, queda sin asignar (asesor = null).',
  })
  @ApiCreatedResponse({
    description: 'Solicitud creada. Respuesta: { success: true, data: solicitud }',
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o campos que no se permiten',
  })
  crear(
    @Body() dto: CreateSolicitudDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.crear(dto, usuario);
  }

  @Get()
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Consultar solicitudes con filtros y paginación',
    description:
      'Admin y supervisor ven todas. El asesor solo ve las que tiene asignadas, ' +
      'aunque envíe asesor=otro_usuario. Los filtros enviados se aplican en conjunto.',
  })
  @ApiOkResponse({
    description:
      'Página de solicitudes y metadatos de paginación (totalPages = 0 si no hay resultados).',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            items: {
              type: 'array',
              items: { $ref: getSchemaPath(Solicitud) },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number', example: 1 },
                limit: { type: 'number', example: 10 },
                total: { type: 'number', example: 25 },
                totalPages: { type: 'number', example: 3 },
              },
            },
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Parámetro inválido (page=0, limit fuera de 1-100, estado o fecha inválidos) o desde posterior a hasta',
  })
  listar(
    @Query() query: ListarSolicitudesQueryDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.listar(query, usuario);
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Consultar una solicitud por id',
    description: 'Un asesor solo puede consultar solicitudes que tiene asignadas.',
  })
  @ApiParam({ name: 'id', description: 'Id de la solicitud', example: 1 })
  @ApiOkResponse({
    description: 'Solicitud encontrada. Respuesta: { success: true, data: solicitud }',
  })
  @ApiBadRequestResponse({ description: 'El id no es un número' })
  @ApiForbiddenResponse({ description: 'El rol no tiene permiso' })
  @ApiNotFoundResponse({
    description: 'La solicitud no existe o es de otro asesor',
  })
  buscarPorId(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.buscarPorId(id, usuario);
  }

  @Patch(':id/estado')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Cambiar el estado de una solicitud',
    description:
      'Solo se permite PENDIENTE -> EN_GESTION y EN_GESTION -> RESUELTA. ' +
      'Un asesor solo puede cambiar solicitudes que tiene asignadas. ' +
      'Registra un evento ESTADO en el historial.',
  })
  @ApiParam({ name: 'id', description: 'Id de la solicitud', example: 1 })
  @ApiOkResponse({
    description: 'Estado actualizado. Respuesta: { success: true, data: solicitud }',
  })
  @ApiBadRequestResponse({
    description: 'Estado inválido o transición no permitida',
  })
  @ApiForbiddenResponse({ description: 'El rol no tiene permiso' })
  @ApiNotFoundResponse({
    description: 'La solicitud no existe o es de otro asesor',
  })
  cambiarEstado(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEstadoDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.cambiarEstado(id, dto, usuario);
  }

  @Patch(':id/asignacion')
  @Roles('admin', 'supervisor')
  @ApiOperation({
    summary: 'Asignar o reasignar una solicitud a un asesor',
    description:
      'Solo admin y supervisor. El asesorId debe existir y tener rol asesor. ' +
      'No cambia el estado de la solicitud y registra un evento ASIGNACION en el historial.',
  })
  @ApiParam({ name: 'id', description: 'Id de la solicitud', example: 1 })
  @ApiOkResponse({
    description: 'Solicitud asignada. Respuesta: { success: true, data: solicitud }',
  })
  @ApiBadRequestResponse({
    description: 'asesorId faltante o vacío, o el usuario no existe / no tiene rol asesor',
  })
  @ApiForbiddenResponse({ description: 'Solo admin y supervisor pueden asignar' })
  @ApiNotFoundResponse({ description: 'La solicitud no existe' })
  @ApiConflictResponse({
    description: 'La solicitud está RESUELTA o ya estaba asignada a ese asesor',
  })
  asignar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarSolicitudDto,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.asignar(id, dto, usuario);
  }

  @Get(':id/historial')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Consultar el historial de una solicitud',
    description:
      'Eventos CREACION, ESTADO y ASIGNACION ordenados del más antiguo al más reciente. ' +
      'Admin y supervisor ven el de cualquiera; un asesor solo el de solicitudes asignadas a él.',
  })
  @ApiParam({ name: 'id', description: 'Id de la solicitud', example: 1 })
  @ApiOkResponse({
    description: 'Lista de eventos. Respuesta: { success: true, data: [eventos] }',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(SolicitudHistorial) },
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'El id no es un número' })
  @ApiForbiddenResponse({ description: 'El rol no tiene permiso' })
  @ApiNotFoundResponse({
    description: 'La solicitud no existe o es de otro asesor',
  })
  obtenerHistorial(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() usuario: AuthenticatedUser,
  ) {
    return this.solicitudesService.obtenerHistorial(id, usuario);
  }
}
