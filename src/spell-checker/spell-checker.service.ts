import { Injectable,Logger } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
import OpenAI from 'openai';
import axios from 'axios';
import {fetchGoogleAds,filterOutTextlessAds,prepareAdsForGpt} from './utils';
import {fixingGrammErrorsPrompt2 } from './consts';
import { KnexService } from 'src/knex/knex.service';
 import { GlobalStateService } from 'src/globalState/global-state.service';
const logger = new Logger('analytical-tools.spellchecker');
 import { GptService } from 'src/gpt/gpt.service';
import { logToCloudWatch } from 'src/logger';
import { jsonToObject } from '@your-scope/my-utils';

@Injectable()
export class SpellCheckerService {

  constructor(
    private readonly knexService: KnexService,
    private readonly globalState: GlobalStateService,
    private readonly gptService: GptService
    ) {}

  async findAndFixGoogleAdsGrammaticalErrors(domainId?: number) {

   let a = jsonToObject('{"a":"you are awesome"}');
return a
   const state = this.globalState.getAllState();
     for (const domain of state.domains) {
      logToCloudWatch((`processing domain ${domain.id}`))
      if (!domain.googleAdsId) continue;
      const adds = await fetchGoogleAds(domain, state.companies, state.allTokens );
      if ((adds && adds.length == 0) || !adds) continue;
      const textfullAds = filterOutTextlessAds(adds);
      if ((textfullAds && textfullAds.length == 0) || !textfullAds) continue;
      const preparedAds =  prepareAdsForGpt(adds)
      const response = await this.gptService.askGpt(state.gptKey, preparedAds);
      return response.choices[0].message.content || 'no errors found';
  }
 
 
  }







  create(createSpellCheckerDto: CreateSpellCheckerDto) {
    return 'This action adds a new spellChecker';
  }

 

  findOne(id: number) {
    return `This action returns a #${id} spellChecker`;
  }

  update(id: number, updateSpellCheckerDto: UpdateSpellCheckerDto) {
    return `This action updates a #${id} spellChecker`;
  }

  remove(id: number) {
    return `This action removes a #${id} spellChecker`;
  }
}
