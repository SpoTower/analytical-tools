import { Module } from '@nestjs/common';
import { SpellCheckerService } from './spell-checker.service';
import { SpellCheckerController } from './spell-checker.controller';
import { KnexService } from '../knex/knex.service';
  import { GptService } from 'src/gpt/gpt.service';
  import { GlobalStateService } from 'src/globalState/global-state.service';
  import { BingService } from 'src/bing/bing.service';

@Module({
  controllers: [SpellCheckerController],
  providers: [SpellCheckerService, KnexService,GlobalStateService,GptService, BingService ],
})
export class SpellCheckerModule {}
