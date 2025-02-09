import { Injectable, OnModuleInit } from '@nestjs/common';
import { KnexService } from 'src/knex/knex.service';
import axios from 'axios';
import dayjs from 'dayjs';

@Injectable()
export class GlobalStateService implements OnModuleInit {
    constructor(
        private readonly knexService: KnexService,
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
      const domainsDaysBack = dayjs().subtract(1, 'day').format('YYYY-MM-DD');

         let domains = await this.knexService.getClient()('domain').select('*');
       // let companies = await this.knexService.getClient()('companies').select('*');
        const gptKey = await axios.get(`http://localhost:3000/secrets?secretName=kidonSecrets`,{headers: { Authorization: `Bearer ${process.env.KIDON_TOKEN}` }, } )
      //  const allTokens = await axios.get(`http://localhost:3000/company/googleTokens`, {headers: { Authorization: `Bearer ${process.env.KIDON_TOKEN}` },})
     //   const domainsPaths =   await this.knexService.getClient()('tracker_visitors as tv').select('*').where('tv.created_at', '>', domainsDaysBack)
         const paths = await this.knexService.getClient()('paths').select('*') 
        
 
       
        
       this.setState('domains', domains);
     //   this.setState('companies', companies);
       this.setState('gptKey', gptKey.data.GPT_API_KEY);
      //  this.setState('allTokens', allTokens);
    //    this.setState('domainsPaths', domainsPaths);
      this.setState('paths', paths);

      console.log('✅ Global state initialized with data');
    } catch (error) {
      console.error('❌ Error fetching initial data:', error);
    }
  }

}
