import { Module } from '@nestjs/common';
import { BingService } from './bing.service';
import { BingController } from './bing.controller';
import { GlobalStateService } from 'src/globalState/global-state.service';

@Module({
  controllers: [BingController],
  providers: [BingService, GlobalStateService],
})
export class BingModule {}
