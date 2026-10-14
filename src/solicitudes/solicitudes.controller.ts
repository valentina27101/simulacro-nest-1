import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { UpdateEstadoDto } from './dto/update-estado.dto';
import { SolicitudesService } from './solicitudes.service';

@ApiTags('Solicitudes')
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
      'Crea una solicitud en estado PENDIENTE. El responsable es el usuario de x-user.',
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
    summary: 'Consultar las solicitudes permitidas',
    description:
      'Admin y supervisor ven todas. El asesor solo ve las suyas.',
  })
  @ApiOkResponse({
    description: 'Lista de solicitudes. Respuesta: { success: true, data: [...] }',
  })
  listar(@CurrentUser() usuario: AuthenticatedUser) {
    return this.solicitudesService.listar(usuario);
  }

  @Get(':id')
  @Roles('admin', 'supervisor', 'asesor')
  @ApiOperation({
    summary: 'Consultar una solicitud por id',
    description: 'Un asesor solo puede consultar solicitudes propias.',
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
      'Un asesor solo puede cambiar solicitudes propias.',
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
}
