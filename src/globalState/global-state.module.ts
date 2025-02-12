import { Module, Global } from '@nestjs/common';
import { GlobalStateService } from './global-state.service';
import { KnexService } from '../knex/knex.service';


@Global()
@Module({
  providers: [GlobalStateService,KnexService],
  exports: [GlobalStateService],
})
export class GlobalStateModule {}
