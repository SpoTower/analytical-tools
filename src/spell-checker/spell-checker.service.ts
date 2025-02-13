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
 import { Domain,Paths } from 'src/kidonInterfaces/shared';
 import { State } from 'src/globalState/interfaces';
  import {processInBatches} from './utils';
 const { chromium } = require('playwright');
import {adsForGpt } from './interfaces';

 @Injectable()
export class SpellCheckerService {

  constructor(
    private readonly knexService: KnexService,
    private readonly globalState: GlobalStateService,
    private readonly gptService: GptService
    ) {}

  async findAndFixGoogleAdsGrammaticalErrors( batchSize: number, domainId?: number, sliceSize?: number  ) {

     const gptResponse = [] 
     const requestMetadata = {source: process.env.SOURCE, recipient: process.env.SERVICE_GMAIL};
 
     const state = this.globalState.getAllState();
        let domainsToProcess = state.domains.filter((domain : Domain) => domain.googleAdsId).filter((domain: Domain) => !domainId || domain.id === domainId);; // Only domains with googleAdsId
      domainsToProcess = domainsToProcess.slice(0, sliceSize || domainsToProcess.length);  
     // ✅ Step 1: Batch Fetch Google Ads for Domains
     const fetchTasks = domainsToProcess.map((domain: Domain) => async () => {
         try {
             logToCloudWatch(`Fetching Google Ads for domain ${domain.id}`);
             return {domain, ads: await fetchGoogleAds(domain, state.companies, state.allTokens)};
         } catch (error) {
             logToCloudWatch(`❌ Error fetching Google Ads for domain ${domain.id}: ${error.message}`, "ERROR");
             return { domain, ads: [] };  
         }
     });
 
   
     const fetchedAdsResults = await processInBatches(fetchTasks, batchSize);
     const fetchedAdsFiltered = fetchedAdsResults.filter((f)=> f.ads.length > 0)
     const textfullAds = filterOutTextlessAds(fetchedAdsFiltered)
     if(!textfullAds || textfullAds.length === 0) return 'No textfull ads found'
     const preparedAds = prepareAdsForGpt(textfullAds);  // row per domain+path

     for (const ad of preparedAds) {
      const response = await this.gptService.askGpt(state.gptKey, ad);
      gptResponse.push(`error: ${response.choices[0].message.content}, resource: ${ad.resourceName}`);
     }


     
   await axios.get(`${process.env.KIDON_SERVER}/etl/sendEmail`, {headers: { Authorization: `Bearer ${process.env.KIDON_TOKEN}` }, params: { gptResponses:  gptResponse, requestMetadata }});

    return `${gptResponse?.length} ads were processed by gpt and sent to kidon to be sended by mail to service gmail`;
 
 
  }
  async findAndFixWebsitesGrammaticalErrors(domainId?: number, batchSize?: number) {

    try {
        const state = this.globalState.getAllState();
        const chosenDomains = domainId ? state.domains.filter((d: Domain) => d.id === domainId) : state.domains;
        chosenDomains.forEach((domain: Domain) => {domain.paths = state.paths.filter((p: Paths) => p.domain_id === domain.id).map((p: Paths) => p.path); });   
        const websitesInnerHtml: websiteText[] = await fetchWebsitesInnerHtml((state as State), batchSize);
        let gptErrorDetectionResults: gptProposal[] = await detectErrorsWithGpt((state as State),websitesInnerHtml, this.gptService, batchSize);
       // gptErrorDetectionResults =   filterOutIrrelevantErrors(gptErrorDetectionResults)
        await axios.get(`${process.env.KIDON_SERVER}/etl/sendEmail`, {headers: { Authorization: `Bearer ${process.env.KIDON_TOKEN}` }, params: { gptResponses: gptErrorDetectionResults.sort((a, b) => a.domain - b.domain) }});
    } catch (error) {
        logToCloudWatch(error?.message || 'Error in findAndFixWebsitesGrammaticalErrors', 'ERROR');
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
