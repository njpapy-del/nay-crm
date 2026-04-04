import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotGateway } from './chatbot.gateway';
import { RemindersService } from './reminders.service';
import { LlmService } from './llm.service';

@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotGateway, RemindersService, LlmService],
  exports: [RemindersService, ChatbotService],
})
export class ChatbotModule {}
