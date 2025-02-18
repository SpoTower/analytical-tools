import { Injectable,Logger } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
 import {fetchGoogleAds,filterOutTextlessAds,prepareAdsForErrorChecking,fetchWebsitesInnerHtml, detectErrorsWithGpt, detectErrorsWithGpt2 } from './utils';
 import { KnexService } from 'src/knex/knex.service';
import { GlobalStateService } from 'src/globalState/global-state.service';
 const logger = new Logger('analytical-tools.spellchecker');
 import { GptService } from 'src/gpt/gpt.service';
 import { logToCloudWatch } from 'src/logger'; 
import axios from 'axios';
 import {websiteText,adsPreparedForErrorDetection} from './interfaces';
 import { Domain,Paths } from 'src/kidonInterfaces/shared';
   import {processInBatches,extractMisspelledWords} from './utils';
 import {googleAds } from './interfaces';
import spellchecker from 'spellchecker';
 export {emailSubjects} from './consts';
import * as KF from '@spotower/my-utils';
  import {googleAdsIgnoreList,webSitesIgnoreWords,ignoredLanguages} from './ignoreWords';


//state.paths.filter((p) => !ignoredLanguages.some(lang => p.path.includes(lang)));




  @Injectable()
export class SpellCheckerService {

  constructor(
    private readonly knexService: KnexService, 
    private readonly globalState: GlobalStateService,
    private readonly gptService: GptService
    ) {}

  async findAndFixGoogleAdsGrammaticalErrors( batchSize: number, domainId?: number, sliceSize?: number,   ) {
    logToCloudWatch('entering findAndFixGoogleAdsGrammaticalErrors');

    const state = this.globalState.getAllState(); if(!state) return 'No state found';
    let domainsToProcess = state.domains.filter((domain : Domain) => domain.googleAdsId).filter((domain: Domain) => !domainId || domain.id === domainId);; // Only domains with googleAdsId
    domainsToProcess = domainsToProcess.slice(0, sliceSize || domainsToProcess.length);  


     // ✅ Step 1: Batch Fetch Google Ads per domain of Domains
     const googleAdsPromiseRequests = domainsToProcess.map((domain: Domain) => async () => {
         try {
             return {domain, ads: await fetchGoogleAds(domain, state.companies, state.allTokens)};
         } catch (error) {
             logToCloudWatch(`❌ Error fetching Google Ads for domain ${domain.id}: ${error.message}`, "ERROR");
             return { domain, ads: [] };  
         }
     });
      const fetchedAdsResults : googleAds[] = await processInBatches(googleAdsPromiseRequests, batchSize);

    // ✅ Step 2: filtering out textless ads and preparing the ads for grammar checking
     const fetchedAdsFiltered = fetchedAdsResults.filter((f)=> f.ads.length > 0)
     const textfullAds = filterOutTextlessAds(fetchedAdsFiltered)
     if(!textfullAds || textfullAds.length === 0) return 'No textfull ads found'
     let preparedAds = prepareAdsForErrorChecking(textfullAds);  // row per domain+path
     let csvData = "resource,errors,domain,googleAdsId,wholeSentence,location\n"; // Add CSV headers

     // ✅ Step 3: checking errors and sending them in mail
     for (const ad of (preparedAds as adsPreparedForErrorDetection[])) {
      [...ad.descriptions, ...ad.headlines].forEach((item) => {
          const misspelledWords = extractMisspelledWords(item.text, googleAdsIgnoreList);
          if (misspelledWords.length > 0) {
              csvData += `"${ad.resourceName}","${misspelledWords.join(',')}","${ad.domain}","${ad.googleAdsId}","${item.text}","${ad.descriptions.includes(item) ? 'descriptions' : 'headline'}"\n`;
          }
      });
  }  
    logToCloudWatch(`csvData length (expected number of rows in excel): ${csvData.split('\n').length}`);
     await KF.sendEmail(process.env.SERVICE_GMAIL, 'googleAds errors!', csvData, state.emailClientPassword);
    return `ads were processed by local spellchecker and sent to kidon to be sended by mail to service gmail`;
  }



  async findAndFixWebsitesGrammaticalErrors(domainId?: number, batchSize?: number) {
        const state = this.globalState.getAllState(); if(!state) return 'No state found';

        // ✅ Step 1: filter non english paths out and assign relevant paths to domains
         const chosenDomains = domainId ? state.domains.filter((d: Domain) => d.id === domainId) : state.domains; // all domain or certain domain
         const englishPats =  state.paths.filter((p) => !ignoredLanguages.some(lang => p.path.includes(lang)));  //filter out non english paths
         chosenDomains.forEach((domain: Domain) => {domain.paths = englishPats.filter((p: Paths) => p.domainId === domain.id).map((p: Paths) => p.path).filter((p)=> p); });  // asign paths per domain
 
        // ✅ Step 2: fetch all paths' text,   check each word for errors and send result to mail
        let websitesMetadataAndText: websiteText[] = await fetchWebsitesInnerHtml(chosenDomains, batchSize); //get inner html of websites
        websitesMetadataAndText.forEach(webSiteText => { webSiteText.detectedErrors = extractMisspelledWords(webSiteText.innerHtml, webSitesIgnoreWords); }); // assign array of errors to each website     
        websitesMetadataAndText = websitesMetadataAndText.filter((w) => w.detectedErrors.length > 0); // Remove websites with no errors

      let csvData = "domain,fullPath,detectedErrors\n"; // Add CSV headers
      for (const website of websitesMetadataAndText) {
          csvData += `"${website.domain}","${website.fullPath}","${website.detectedErrors.join(',')}"\n`;
        }
     //   await KF.sendEmail(process.env.SERVICE_GMAIL, 'Websites errors!', csvData, state.emailClientPassword);
        return `websites were processed by local spellchecker and sent to kidon to be sended by mail to service gmail`;
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


