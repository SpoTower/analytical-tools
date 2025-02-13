import { Injectable } from '@nestjs/common';
import { CreateGptDto } from './dto/create-gpt.dto';
import { UpdateGptDto } from './dto/update-gpt.dto';
const OpenAI = require('openai').OpenAI;
import {fixingGrammErrorsPrompt2,locatingWebSitesErrors,locatingWebSitesErrors2} from '../spell-checker/consts';
import { logToCloudWatch } from 'src/logger';
import { adsForGpt } from 'src/spell-checker/interfaces';
@Injectable()
export class GptService {
  create(createGptDto: CreateGptDto) {
    return 'This action adds a new gpt';
  }

  findAll() {
    return `This action returns allw gpt`;
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
