import { Injectable,Logger } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
 import {fetchGoogleAds,filterOutTextlessAds,prepareAdsForGpt,fetchWebsitesInnerHtml, detectErrorsWithGpt, detectErrorsWithGpt2 } from './utils';
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
import {googleAds } from './interfaces';
import spellchecker from 'spellchecker';
import { emailSubjects, isWordsInEnglish } from './consts';
export {emailSubjects} from './consts';
import * as KF from '@spotower/my-utils';
  


 @Injectable()
export class SpellCheckerService {

  constructor(
    private readonly knexService: KnexService, 
    private readonly globalState: GlobalStateService,
    private readonly gptService: GptService
    ) {}

  async findAndFixGoogleAdsGrammaticalErrors( batchSize: number, domainId?: number, sliceSize?: number,   ) {
    logToCloudWatch('entering findAndFixGoogleAdsGrammaticalErrors');

     const state = this.globalState.getAllState();
     if(!state) return 'No state found';
        let domainsToProcess = state.domains.filter((domain : Domain) => domain.googleAdsId).filter((domain: Domain) => !domainId || domain.id === domainId);; // Only domains with googleAdsId
      domainsToProcess = domainsToProcess.slice(0, sliceSize || domainsToProcess.length);  
     // ✅ Step 1: Batch Fetch Google Ads for Domains
     const fetchTasks = domainsToProcess.map((domain: Domain) => async () => {
         try {
             return {domain, ads: await fetchGoogleAds(domain, state.companies, state.allTokens)};
         } catch (error) {
             logToCloudWatch(`❌ Error fetching Google Ads for domain ${domain.id}: ${error.message}`, "ERROR");
             return { domain, ads: [] };  
         }
     });
 
   
     const fetchedAdsResults : googleAds[] = await processInBatches(fetchTasks, batchSize);
     const fetchedAdsFiltered = fetchedAdsResults.filter((f)=> f.ads.length > 0)
     const textfullAds = filterOutTextlessAds(fetchedAdsFiltered)
     if(!textfullAds || textfullAds.length === 0) return 'No textfull ads found'
     let preparedAds = prepareAdsForGpt(textfullAds);  // row per domain+path
     let csvData = "resource,errors,domain,googleAdsId,wholeSentence,location\n"; // Add CSV headers

     for (const ad of preparedAds) {
         for (const description of ad.descriptions) {

            const misspelledWords = description.text.split(" ").filter(word => spellchecker.isMisspelled(word));
            if (misspelledWords.length > 0) {
              csvData += `"${ad.resourceName}","${misspelledWords.join(',')}","${ad.domain}","${ad.googleAdsId}","${description.text}","descriptions"\n`;
            }
        }
        for (const headline of ad.headlines) {
            const misspelledWords = headline.text.split(" ").filter(word => spellchecker.isMisspelled(word));
            if (misspelledWords.length > 0) {
              csvData += `"${ad.resourceName}","${misspelledWords.join(',')}","${ad.domain}","${ad.googleAdsId}","${headline.text}","headline"\n`;
            }
        }
 
     }
    logToCloudWatch(`csvData length (expected number of rows in excel): ${csvData.split('\n').length}`);
     await KF.sendEmail(process.env.SERVICE_GMAIL, 'googleAds errors!', csvData, state.emailClientPassword);
    return `ads were processed by local spellchecker and sent to kidon to be sended by mail to service gmail`;
  }

  async findAndFixWebsitesGrammaticalErrors(domainId?: number, batchSize?: number) {

    const requestMetadata = {source: process.env.SOURCE, emailRecipient: process.env.SERVICE_GMAIL, emailSubject: emailSubjects.WEBSITES_GRAMMATICAL_ERRORS };
    await axios.get(`${process.env.KIDON_SERVER}/etl/sendEmail`, {headers: { Authorization: `Bearer ${process.env.KIDON_TOKEN}` }, params: { gptResponses: 'gptErrorDetectionResults' , requestMetadata }});

        const state = this.globalState.getAllState();
        if(!state) return 'No state found';

        const chosenDomains = domainId ? state.domains.filter((d: Domain) => d.id === domainId) : state.domains;
        chosenDomains.forEach((domain: Domain) => {domain.paths = state.paths.filter((p: Paths) => p.domainId === domain.id).map((p: Paths) => p.path); });   
        const websitesInnerHtml: websiteText[] = await fetchWebsitesInnerHtml(chosenDomains, batchSize);
        let gptErrorDetectionResults: string = await detectErrorsWithGpt( state.gptKey  ,websitesInnerHtml, this.gptService, batchSize);
 try {
          (gptErrorDetectionResults && gptErrorDetectionResults.length > 0) &&
               await axios.get(`${process.env.KIDON_SERVER}/etl/sendEmail`, {headers: { Authorization: `Bearer ${process.env.KIDON_TOKEN}` }, params: { gptResponses: gptErrorDetectionResults , requestMetadata }});

 } catch (error) {
  console.log('error in sending email', error)
 }

        return `${gptErrorDetectionResults?.split('domain').filter(Boolean).length} websites pages (paths) were processed by gpt and sent to kidon to be sended by mail to service gmail`;

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
