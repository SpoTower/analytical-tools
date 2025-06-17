import { Module } from '@nestjs/common';
import { FrontEndService } from './front-end.service';
import { FrontEndController } from './front-end.controller';
import { SpellCheckerService } from 'src/spell-checker/spell-checker.service';
import { BingService } from 'src/bing/bing.service';
import { GlobalStateService } from 'src/globalState/global-state.service';
import { GptService } from 'src/gpt/gpt.service';
import { KIDON_CONNECTION } from 'src/knex/knex.module';
import { ConfigService } from '@nestjs/config';
import { Knex } from 'knex';
@Module({
  controllers: [FrontEndController],
  providers: [FrontEndService, SpellCheckerService, BingService, GlobalStateService, GptService, ],
})
export class FrontEndModule {}
