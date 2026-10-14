import { Module } from '@nestjs/common';
import { UsersService } from './users.service';

@Module({
  providers: [UsersService],
  // Se exporta para que el UserGuard pueda usarlo.
  exports: [UsersService],
})
export class UsersModule {}
