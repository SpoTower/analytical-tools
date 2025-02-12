// database.module.ts
import { Global, Module } from '@nestjs/common';
import knex, { Knex } from 'knex';
import  {analyticsDbConfig, kidonDbConfig } from './knexfile';

export const ANALYTICS_CONNECTION = 'ANALYTICS_CONNECTION';
export const KIDON_CONNECTION = 'KIDON_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: ANALYTICS_CONNECTION,
      useFactory: async (): Promise<Knex> => {
        return knex(await analyticsDbConfig());
      },
    },
    {
      provide: KIDON_CONNECTION,
      useFactory: async (): Promise<Knex> => {
        return knex(await kidonDbConfig());
      },
    },
  ],
  exports: [ANALYTICS_CONNECTION, KIDON_CONNECTION],
})
export class KnexModule {}
