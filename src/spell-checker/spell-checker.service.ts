import { Injectable,Logger } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
 import {fetchGoogleAds,filterOutTextlessAds,prepareAdsForGpt} from './utils';
 import { KnexService } from 'src/knex/knex.service';
import { GlobalStateService } from 'src/globalState/global-state.service';
 const logger = new Logger('analytical-tools.spellchecker');
 import { GptService } from 'src/gpt/gpt.service';
 import { logToCloudWatch } from 'src/logger'; 
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
         state.domains.forEach(domain => {domain.paths = state.paths.filter(p => p.domain_id === domain.id)   .map(p => p.path); });
 
      let websiteInnerHtml = [];
      const websitesInnerHtml: any[][] = [];
      const gptErrorDetectionResult: any[] = [];
      const gptErrorDetectionResults: any[] = [];

    for (const domain of state.domains) {
      if ( domain?.id > 3) continue
      if (!domain?.hostname) continue
      const browser = await chromium.launch({ headless: false }); // set headless: false for debugging

      for (const path of domain.paths.slice(0,2)) {
        const page = await browser.newPage();
        const url = `https://${domain.hostname}${path}`;

            await page.goto(url, { waitUntil: 'load' });
            const pageText = await page.evaluate(() => document.body.innerText);
            await page.close()

            websiteInnerHtml.push({domain: domain.id, fullPath:`https://${domain.hostname}${path}`, innerHtml: pageText});

    }
    websitesInnerHtml.push(websiteInnerHtml)
    websiteInnerHtml = []
    await browser.close(); // Close browser after processing all paths for a domain
}
  for (const domain of websitesInnerHtml) {
     for (const pathText of domain) {
        const gptResponse = await this.gptService.askGpt2(state.gptKey, pathText)
        gptErrorDetectionResult.push({domain:pathText.domain, path: pathText.fullPath, errors: gptResponse.choices[0].message.content})
     }
     gptErrorDetectionResults.push(gptErrorDetectionResult)
  }
 console.log(gptErrorDetectionResults)
    } catch (error) {
      logger.error(error)
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
