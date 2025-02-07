import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import knex, { Knex } from 'knex';
import knexConfig from '../../knexfile';

@Injectable()
export class KnexService implements OnModuleInit, OnModuleDestroy {
  private knexInstance: Knex;

  onModuleInit() {
    this.knexInstance = knex(knexConfig);
  }

  getClient(): Knex {
    return this.knexInstance;
  }

  async onModuleDestroy() {
    await this.knexInstance.destroy();
  }
}
