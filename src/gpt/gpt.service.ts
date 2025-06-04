import { Injectable, Inject  } from '@nestjs/common';
import { CreateGptDto } from './dto/create-gpt.dto';
import { Knex } from 'knex';

import { UpdateGptDto } from './dto/update-gpt.dto';
const OpenAI = require('openai').OpenAI;
import { locatingWebSitesErrors} from '../spell-checker/consts';
import { logToCloudWatch } from 'src/logger';
import { adsForGpt } from 'src/spell-checker/interfaces';
import { ANALYTICS_CONNECTION  } from 'src/knex/knex.module';
import { CONFIGURATION } from 'src/knex/tableNames';
//import { UpdatePromptDto } from './dto/update-prompts.dto';


@Injectable()
export class GptService {
  constructor(
    @Inject(ANALYTICS_CONNECTION) private readonly analyticsDb: Knex,
  ) {}


  create(createGptDto: CreateGptDto) {
    return 'This action adds a new gpt';
  }
  async findAll() {
    try {
      const configs = await this.analyticsDb(CONFIGURATION).select('*');
      return configs.map(item => ({ key: item.key, values: item.values }));

 
     
    } catch (error) {
      logToCloudWatch(`Error in findAll: ${error}`);
      throw error;
    }
  }

  async findConfigurationByKeys(keys: string[]) {
    try {
      logToCloudWatch(`Entering findConfigurationByKeys. keys: ${keys}`);
      const result = await this.analyticsDb(CONFIGURATION).select('*').whereIn('key', keys);
      logToCloudWatch(`Exiting findConfigurationByKeys. result: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      logToCloudWatch(`Error in findConfigurationByKeys: ${error}`);
      throw error;
    }
  }

  async updateConfigurationPrompt({ key, value }: any) {
    try {
     let res =  await this.analyticsDb(CONFIGURATION).where('key', key).update({ values: value });
      const updated = await this.analyticsDb(CONFIGURATION).where('key', key).first();
      return updated;
    } catch (error) {
      logToCloudWatch(`Error in updateConfigurationPrompt: ${error}`);
      throw error;
    }
  }

  async askGpt(gptKey:string, extractedAds: adsForGpt ) {
    logToCloudWatch(`Entering askGpt. asking gpt for ads ${extractedAds.id}`)
     const openai = new OpenAI({apiKey: gptKey,  });

   return await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: locatingWebSitesErrors() },
            {
                role: 'user',
                content: `objectId: ${extractedAds.id},
            headlines: ${JSON.stringify(extractedAds.headlines.map((t) => t.text))}
              descriptions: ${JSON.stringify(extractedAds.descriptions.map((t) => t.text))}`,
            },
        ],
        max_tokens: 4000,
        temperature: 0,
    });
  }
  async askGpt2(gptKey:string, extractedAds: any ) {
      const openai = new OpenAI({apiKey: gptKey,  });

   return await openai. chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: locatingWebSitesErrors() },
            {
                role: 'user',
                content: JSON.stringify(extractedAds),
            },
        ],
        max_tokens: 4000,
        temperature: 0,
    });
  }
  async askGptString(gptKey:string, extractedAds: any, prompt: string ) {
    const openai = new OpenAI({apiKey: gptKey,  });

 return await openai. chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
          { role: 'system', content:prompt   },
          {
              role: 'user',
              content: extractedAds,
          },
      ],
      max_tokens: 4000,
      temperature: 0,
  });
}

async askGpt01(gptKey: string, prompt: string, userContent: string) {
  const openai = new OpenAI({ apiKey: gptKey })

  const res =  await openai.chat.completions.create({
    model: 'gpt-4o',
      messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userContent },
      ],
      max_tokens: 4000,
      temperature: 0.4,
  })

  return res
}



  findOne(id: number) {
    return `This action returns a #${id} gpt`;
  }

  update(id: number, updateGptDto: UpdateGptDto) {
    return `This action updates a #${id} gpt`;
  }

  remove(id: number) {
    return `This action removes a #${id} gpt`;
  }
}
