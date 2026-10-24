import { Module } from '@nestjs/common';
import { ChatbotController } from './chatbot.controller';
import { ChatbotService } from './chatbot.service';
import { ChatbotAgentService } from './chatbot-agent.service';
import { ChatbotToolsService } from './chatbot-tools.service';

// 24/10/2026: Chat bot noi bo (RAG tai lieu + tool-calling, Technical_Spec.md muc 23) - module doc lap,
// khong phu thuoc AnalyticsModule/AiInsightsModule (chi dung chung cau hinh gemini/groq va DataSource
// TimescaleDB mac dinh cua app.module.ts).
@Module({
  controllers: [ChatbotController],
  providers: [ChatbotService, ChatbotAgentService, ChatbotToolsService],
})
export class ChatbotModule {}
