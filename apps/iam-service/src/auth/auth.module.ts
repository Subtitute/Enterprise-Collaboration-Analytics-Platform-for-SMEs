import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { RefreshToken } from '../entities/refresh-token.entity';
import { PasswordResetToken } from '../entities/password-reset-token.entity';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { OutboxModule } from '../outbox/outbox.module';
import { RolesModule } from '../roles/roles.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, PasswordResetToken]),
    JwtModule.register({}),
    OutboxModule,
    RolesModule,
    EmailModule,
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
