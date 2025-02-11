import { Inject, Module } from '@nestjs/common';
import { AbTestManagementService } from './ab-test-management.service';
import { AbTestManagementController } from './ab-test-management.controller';
import { Knex } from 'knex';
import { ANALYTICS_CONNECTION, KIDON_CONNECTION } from 'src/knex/knex.module';
import { KnexService } from 'src/knex/knex.service';

@Module({
  controllers: [AbTestManagementController],
  providers: [AbTestManagementService, KnexService],
})
export class AbTestManagementModule {}


