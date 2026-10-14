import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';

// Envuelve todas las respuestas exitosas con el mismo formato.
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<{ success: true; data: unknown }> {
    return next.handle().pipe(map((data: unknown) => ({ success: true, data })));
  }
}
