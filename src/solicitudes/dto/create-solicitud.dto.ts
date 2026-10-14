import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

// Quita los espacios de los extremos para que "   " cuente como vacío.
const quitarEspacios = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Solo se reciben cliente y descripción. El id, las fechas, el estado y el
// asesor los define el sistema, por eso no están aquí.
export class CreateSolicitudDto {
  @ApiProperty({
    description: 'Nombre del cliente',
    example: 'Empresa ABC S.A.S.',
  })
  @Transform(quitarEspacios)
  @IsString({ message: 'cliente debe ser un texto' })
  @IsNotEmpty({ message: 'cliente no puede estar vacío' })
  cliente: string;

  @ApiProperty({
    description: 'Motivo de la solicitud',
    example: 'El cliente pide una cotización de 50 licencias',
  })
  @Transform(quitarEspacios)
  @IsString({ message: 'descripcion debe ser un texto' })
  @IsNotEmpty({ message: 'descripcion no puede estar vacía' })
  descripcion: string;
}
