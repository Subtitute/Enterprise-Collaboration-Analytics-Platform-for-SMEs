import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEvent } from '../entities/calendar-event.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { CalendarEventsService } from './calendar-events.service';
import { CalendarEventsController } from './calendar-events.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CalendarEvent]), OutboxModule],
  providers: [CalendarEventsService],
  controllers: [CalendarEventsController],
  exports: [CalendarEventsService],
})
export class CalendarEventsModule {}
