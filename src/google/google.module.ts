import { Module } from '@nestjs/common';
import { GoogleService } from './google.service';
import { GoogleController } from './google.controller';
import { GlobalStateService } from 'src/globalState/global-state.service';
import { GptService } from 'src/gpt/gpt.service';

@Module({
  controllers: [GoogleController],
  providers: [GoogleService,GlobalStateService,GptService],
})
export class GoogleModule {}
