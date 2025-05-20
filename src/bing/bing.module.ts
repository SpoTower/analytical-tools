import { Module } from '@nestjs/common';
import { BingService } from './bing.service';
import { BingController } from './bing.controller';

@Module({
  controllers: [BingController],
  providers: [BingService],
})
export class BingModule {}
