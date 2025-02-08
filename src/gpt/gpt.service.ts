import { Injectable } from '@nestjs/common';
import { CreateGptDto } from './dto/create-gpt.dto';
import { UpdateGptDto } from './dto/update-gpt.dto';
const OpenAI = require('openai').OpenAI;
import {fixingGrammErrorsPrompt2} from '../spell-checker/consts';
import { logToCloudWatch } from 'src/logger';

@Injectable()
export class GptService {
  create(createGptDto: CreateGptDto) {
    return 'This action adds a new gpt';
  }

  findAll() {
    return `This action returns all gpt`;
  }

  async askGpt(gptKey:string, extractedAds: Record<string, any>[]) {
    logToCloudWatch(`Entering askGpt. asking gpt for ads ${extractedAds[0].id}`)
     const openai = new OpenAI({apiKey: gptKey,  });

   return await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: fixingGrammErrorsPrompt2() },
            {
                role: 'user',
                content: `objectId: ${extractedAds[0].id},
            headlines: ${JSON.stringify(extractedAds[0].headlines.map((t) => t.text))}
              descriptions: ${JSON.stringify(extractedAds[0].descriptions.map((t) => t.text))}`,
            },
        ],
        max_tokens: 4000,
        temperature: 0.7,
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
