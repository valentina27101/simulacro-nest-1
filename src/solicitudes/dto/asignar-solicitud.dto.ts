import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

// Que el asesor exista y tenga rol "asesor" se valida en el servicio,
// porque depende del catálogo de usuarios.
export class AsignarSolicitudDto {
  @ApiProperty({
    description: 'Username del asesor que quedará como responsable',
    example: 'asesor2',
  })
  @IsString({ message: 'asesorId debe ser un texto' })
  @IsNotEmpty({ message: 'asesorId no puede estar vacío' })
  asesorId: string;
}
