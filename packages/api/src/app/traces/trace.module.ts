import { Module } from '@nestjs/common';
import { TraceController } from './trace.controller';
import { TraceRepository } from './trace.repository';
import { TraceService } from './trace.service';

@Module({
  controllers: [TraceController],
  providers: [TraceService, TraceRepository],
})
export class TraceModule {}
