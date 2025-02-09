import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import dayjs from 'dayjs';
import { Knex } from 'knex';
import { ANALYTICS_CONNECTION, KIDON_CONNECTION } from 'src/knex/knex.module';

@Injectable()
export class GlobalStateService implements OnModuleInit {
  constructor(
    @Inject(ANALYTICS_CONNECTION) private readonly analyticsClient: Knex,
    @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,
  ) {}
    
  private state: Record<string, any> = {}; // Object to store global data

  async onModuleInit() {
    console.log('🔄 Fetching initial data on startup...');
    await this.loadInitialData(); // Auto-fetch data on startup
  }

  setState(key: string, value: any) {
    this.state[key] = value;
  }

  getState(key: string): any {
    return this.state[key];
  }

  getAllState(): Record<string, any> {
    return this.state;
  }

  async loadInitialData() {
    try {
      const [domains, companies, gptKey, allTokens] = await Promise.all([
        this.kidonClient('domain').select('*'),
        this.kidonClient('companies').select('*'),
        axios.get(`${process.env.KIDON_SERVER}/secrets?secretName=kidonSecrets`, {
            headers: { Authorization: `Bearer ${process.env.KIDON_TOKEN}` },
        }),
        axios.get(`${process.env.KIDON_SERVER}/company/googleTokens`, {
            headers: { Authorization: `Bearer ${process.env.KIDON_TOKEN}` },
        }),
    ]);
        this.setState('domains', domains);
        this.setState('companies', companies);
         this.setState('gptKey', gptKey.data.GPT_API_KEY);
         this.setState('allTokens', allTokens);

      console.log('✅ Global state initialized with data');
    } catch (error) {
      console.error('❌ Error fetching initial data:', error);
    }
  }

}
