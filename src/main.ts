import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // quita propiedades que no están en el DTO
      forbidNonWhitelisted: true, // y en lugar de ignorarlas, responde 400
      transform: true, // convierte tipos y aplica @Transform
    }),
  );
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('API de Solicitudes Comerciales')
    .setDescription(
      'API para registrar solicitudes de seguimiento comercial y gestionar su estado según el rol del usuario.\n\n' +
        'Para probar: pulsa "Authorize", escribe una API Key válida y envía en cada petición el encabezado x-user ' +
        '(admin1, supervisor1, asesor1 o asesor2).',
    )
    .setVersion('1.0')
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document); // http://localhost:3000/docs

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
