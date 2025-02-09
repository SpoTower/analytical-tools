// database.module.ts
import { Global, Module } from '@nestjs/common';
import knex, { Knex } from 'knex';
import { analyticsDbConfig, kidonDbConfig } from './knexConfig';

export const ANALYTICS_CONNECTION = 'ANALYTICS_CONNECTION';
export const KIDON_CONNECTION = 'KIDON_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: ANALYTICS_CONNECTION,
      useFactory: (): Knex => {
        return knex(analyticsDbConfig);
      },
    },
    {
      provide: KIDON_CONNECTION,
      useFactory: (): Knex => {
        return knex(kidonDbConfig);
      },
    },
  ],
  exports: [ANALYTICS_CONNECTION, KIDON_CONNECTION],
})
export class KnexModule {}
