import { Module } from '@nestjs/common';
import { SpellCheckerService } from './spell-checker.service';
import { SpellCheckerController } from './spell-checker.controller';
import { KnexService } from '../knex/knex.service';
import { GlobalStateService } from '../globalState/global-state.service';

@Module({
  controllers: [SpellCheckerController],
  providers: [SpellCheckerService, KnexService,GlobalStateService],
})
export class SpellCheckerModule {}
