import { Injectable,Logger } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
 import {fetchGoogleAds,filterOutTextlessAds,prepareAdsForGpt,fetchWebsitesInnerHtml, detectErrorsWithGpt} from './utils';
 import { KnexService } from 'src/knex/knex.service';
import { GlobalStateService } from 'src/globalState/global-state.service';
 const logger = new Logger('analytical-tools.spellchecker');
 import { GptService } from 'src/gpt/gpt.service';
 import { logToCloudWatch } from 'src/logger'; 
import axios from 'axios';
 import {websiteText,gptProposal} from './interfaces';
 
 const { chromium } = require('playwright');
@Injectable()
export class SpellCheckerService {

  constructor(
    private readonly knexService: KnexService,
    private readonly globalState: GlobalStateService,
    private readonly gptService: GptService
    ) {}

  async findAndFixGoogleAdsGrammaticalErrors(domainId?: number) {

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
  async findAndFixWebsitesGrammaticalErrors(domainId?: number) {
    try {
        const state = this.globalState.getAllState();
        state.domains.forEach(domain => {domain.paths = state.paths.filter(p => p.domain_id === domain.id) .map(p => p.path); });   
        const batchSize = 10; // Control concurrency manually
        const websitesInnerHtml: websiteText[] = await fetchWebsitesInnerHtml(state, batchSize);
        const gptErrorDetectionResults: gptProposal[] = await detectErrorsWithGpt(state,websitesInnerHtml, this.gptService, batchSize);
        await axios.get(`${process.env.KIDON_SERVER}/etl/sendEmail`, {headers: { Authorization: `Bearer ${process.env.KIDON_TOKEN}` }, params: { gptResponses: gptErrorDetectionResults.sort((a, b) => a.domain - b.domain) }});
    } catch (error) {
        logger.error(error);
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


//      const pLimit = (await import('p-limit')).default;
