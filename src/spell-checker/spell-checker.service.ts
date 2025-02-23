import { Injectable,Logger,Inject } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
 import {fetchGoogleAds,filterOutTextlessAds,prepareAdsForErrorChecking,fetchWebsitesInnerHtmlAndFindErrors, detectErrorsWithGpt, detectErrorsWithGpt2 } from './utils';
import { GlobalStateService } from 'src/globalState/global-state.service';
 const logger = new Logger('analytical-tools.spellchecker');
 import { GptService } from 'src/gpt/gpt.service';
 import { logToCloudWatch } from 'src/logger'; 
 import {adsPreparedForErrorDetection} from './interfaces';
 import { Domain,Paths } from 'src/kidonInterfaces/shared';
   import {processInBatches,extractMisspelledWords} from './utils';
 import {googleAds } from './interfaces';
 export {emailSubjects} from './consts';
import * as KF from '@spotower/my-utils';
  import {googleAdsIgnoreList,ignoredLanguages} from './ignoreWords';
  import { KIDON_CONNECTION } from 'src/knex/knex.module';
  import { Knex } from 'knex';
  import fs from 'fs';
  import path from 'path';
 
//state.paths.filter((p) => !ignoredLanguages.some(lang => p.path.includes(lang)));




  @Injectable()
export class SpellCheckerService {

  constructor(
    @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,
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
     if(!textfullAds || textfullAds.length === 0){
      await KF.sendSlackAlert('Google Ads Errors: No textfull ads found','C08EPQYR6AC', state.slackToken);
      return 'No textfull ads found'
     } 
     let preparedAds = prepareAdsForErrorChecking(textfullAds);  // row per domain+path
     let jsonData = []; // ✅ Change CSV string to a JSON array

     // ✅ Step 3: checking errors and storing them in JSON format
     for (const ad of (preparedAds as adsPreparedForErrorDetection[])) {
         [...ad.descriptions, ...ad.headlines].forEach((item) => {
             const misspelledWords = extractMisspelledWords(item.text, googleAdsIgnoreList);
             if (misspelledWords.length > 0) {
                 jsonData.push({
                     resource: ad.resourceName,
                     errors: misspelledWords,
                     domain: ad.domain,
                     googleAdsId: ad.googleAdsId,
                     wholeSentence: item.text,
                     location: ad.descriptions.includes(item) ? 'descriptions' : 'headline'
                 });
             }
         });
     }
// ✅ Step 4: Format data into a Slack-friendly table
let slackMessage = "```" + 
  "resource                               | errors   | domain                         | googleAdsId  | wholeSentence                                      | location \n" +
  "---------------------------------------|---------|--------------------------------|--------------|--------------------------------------------------|-----------\n";

jsonData.forEach((ad) => {
    slackMessage += `${ad.resource.padEnd(38)}| ${ad.errors.join(",").padEnd(8)}| ${ad.domain.padEnd(30)}| ${ad.googleAdsId.toString().padEnd(12)}| ${ad.wholeSentence.padEnd(50)}| ${ad.location}\n`;
});

slackMessage += "```"; // ✅ Close the monospace block


     
       await KF.sendSlackAlert('Google Ads Errors: ','C08EPQYR6AC', state.slackToken);
       await KF.sendSlackAlert(slackMessage, 'C08EPQYR6AC', state.slackToken);
       return `ads were processed by local spellchecker and sent to kidon to be sended by slack to content errors channel`;
  }



  async findAndFixWebsitesGrammaticalErrors(domainId?: number, batchSize?: number) {
    const state = this.globalState.getAllState(); if(!state) return 'No state found';
        // ✅ Step 1: filter non english paths out and assign relevant paths to domains
        const englishPats =  state.paths.filter((p) => !ignoredLanguages.some(lang => p.path.includes(lang)));  //filter out non english paths

        // ✅ Step 2: filter out non visited domains, attach paths to each domain

        const weekAgo = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0];
        const recentlyVisitedDomains =  await this.kidonClient('tracker_visitors').select('domain_name').where('created_at', '>', weekAgo).whereIn('utm_source', ['GOOGLE', 'BING']).distinct();   
        const chosenDomains = domainId ? state.domains.filter((d: Domain) => d.id === domainId) : state.domains.filter(d => recentlyVisitedDomains.some(r => r.domainName === d.hostname));
        chosenDomains.forEach((domain: Domain) => {domain.paths = englishPats.filter((p: Paths) => p.domainId === domain.id).map((p: Paths) => p.path).filter((p)=> p); });  // asign paths per domain
 
        // ✅ Step 3: fetch all paths' text,   check each word for errors and send result to mail
         await fetchWebsitesInnerHtmlAndFindErrors(chosenDomains, batchSize); //get inner html of websites
 
     //   await KF.sendEmail(process.env.SERVICE_GMAIL, 'Websites errors!', 'csvData', state.emailClientPassword);
        
        const fileContent = fs.readFileSync(path.join(__dirname, '../..', 'savedData.json'), 'utf-8');
              let slackWebsiteMessage = "```" + 
        "Domain  | Full Path                                      | Detected Errors \n" +
        "--------|-----------------------------------------------|-----------------\n";

      // ✅ Add each row formatted properly
      const websiteErrors = JSON.parse(fileContent); // Read saved JSON file

      websiteErrors.forEach((error) => {
          slackWebsiteMessage += `${error.domain.toString().padEnd(8)}| ${error.fullPath.padEnd(45)}| ${error.detectedErrors.join(", ")}\n`;
      });

      slackWebsiteMessage += "```"; // ✅ Close the monospace block
        await KF.sendSlackAlert('Web Sites Errors: ','C08EPQYR6AC', state.slackToken);
        await KF.sendSlackAlert(slackWebsiteMessage,'C08EPQYR6AC', state.slackToken);
        return `websites were processed by local spellchecker and sent to kidon to be sended by slack to content errors channel`;
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


