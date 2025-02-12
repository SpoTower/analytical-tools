import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Knex } from 'knex';
import { ANALYTICS_CONNECTION, KIDON_CONNECTION } from './knex.module';
import { logToCloudWatch } from 'src/logger';


@Injectable()
export class KnexService implements OnModuleDestroy {
  constructor(
    @Inject(ANALYTICS_CONNECTION) private readonly analyticsClient: Knex,
    @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,
  ) {}

  async onModuleDestroy() {
    await Promise.all([
      this.analyticsClient.destroy(),
      this.kidonClient.destroy(),
    ]);
    logToCloudWatch('Knex connections destroyed successfully');
  }
}
