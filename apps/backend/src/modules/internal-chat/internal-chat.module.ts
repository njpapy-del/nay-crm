import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InternalChatController } from './internal-chat.controller';
import { InternalChatService } from './internal-chat.service';
import { InternalChatGateway } from './internal-chat.gateway';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [InternalChatController],
  providers: [InternalChatService, InternalChatGateway],
  exports: [InternalChatService],
})
export class InternalChatModule {}
