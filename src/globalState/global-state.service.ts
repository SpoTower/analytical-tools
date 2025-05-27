import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import axios from 'axios';
import { Knex } from 'knex';
import { ANALYTICS_CONNECTION, KIDON_CONNECTION } from 'src/knex/knex.module';
import { logToCloudWatch } from 'src/logger';
import * as KF from '@spotower/my-utils';

@Injectable()
export class GlobalStateService implements OnModuleInit {
  constructor(
    @Inject(ANALYTICS_CONNECTION) private readonly analyticsClient: Knex,
    @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,
  ) {}
    
  private state: Record<string, any> = {}; // Object to store global data

  async onModuleInit() {
    logToCloudWatch('🔄 Fetching initial data on startup...', 'INFO', 'GlobalStateService');
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
      const [domains, companies,paths, secrets] = await Promise.all([
        this.kidonClient('domain').select('*'),
        this.kidonClient('companies').select('*'),
        this.kidonClient('paths').select('*'),
        
       KF.getSecretFromSecretManager('kidonSecrets'),

    

    ]);

    let golddomain =    domains.find(d => d.id === 27)


        this.setState('domains', domains);
        this.setState('companies', companies);
        this.setState('paths', paths);
        this.setState('gptKey', KF.jsonToObject(secrets).GPT_API_KEY);
        this.setState('emailClientPassword', KF.jsonToObject(secrets).EMAIL_PASSWORD);
        this.setState('slackToken', KF.jsonToObject(secrets).SLACK_TOKEN);

         

    //     this.setState('allTokens', allTokens.data);
        // this.setState('allTokens', allTokens);
         this.setState('requestMetadata'  , {source: 'analytical' });

      logToCloudWatch(`✅ Global state initialized with data domains: ${domains.length} paths:${paths.length}`, 'INFO', 'GlobalStateService');
    } catch (error) {
      logToCloudWatch(`❌ Error fetching initial data: ${error}`, 'ERROR', 'GlobalStateService');
      
    }
  }

}
