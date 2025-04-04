import { Injectable,Logger,Inject } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
 import {fetchGoogleAds,filterOutTextlessAds,prepareAdsForErrorChecking,fetchWebsitesInnerHtmlAndFindErrors, extractNonCapitalLetterWords} from './utils';
import { GlobalStateService } from 'src/globalState/global-state.service';
 const logger = new Logger('analytical-tools.spellchecker');
  import { logToCloudWatch } from 'src/logger'; 
 import {adsPreparedForErrorDetection} from './interfaces';
 import { Domain,Paths } from 'src/kidonInterfaces/shared';
   import {processInBatches,extractMisspelledWords} from './utils';
 import {googleAds } from './interfaces';
 export {emailSubjects} from './consts';
import * as KF from '@spotower/my-utils';
  import {googleAdsIgnoreList,ignoredLanguages,googleAdsNonCapitalLettersIgnoreList} from './ignoreWords';
  import { KIDON_CONNECTION } from 'src/knex/knex.module';
  import { Knex } from 'knex';
  import fs from 'fs';
  import path from 'path';
   const { chromium } = require('playwright');
import { createErrorsTable } from './utils';
 import {slackChannels} from './consts';
 import { getSecretFromSecretManager } from 'src/utils/secrets';



  @Injectable()
export class SpellCheckerService {

  constructor(
    @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,
    private readonly globalState: GlobalStateService,
     ) {}


 
  async findAndFixGoogleAdsGrammaticalErrors(batchSize: number, domainId?: number, sliceSize?: number) {
    logToCloudWatch('entering findAndFixGoogleAdsGrammaticalErrors');

    const state = this.globalState.getAllState();
    if (!state) return 'No state found';

    // Filter and slice domains
    let domainsToProcess = state.domains.filter((domain: Domain) => domain.googleAdsId).filter((domain: Domain) => !domainId || domain.id === domainId) .slice(0, sliceSize || Infinity);
    // Get Google tokens for all companies
    const allTokens = await Promise.all(state.companies.map(async (c) => ({ company: c.name,token: await KF.getGoogleAuthToken(c)})));

    // Fetch Google Ads in batches
    const fetchedAdsResults: googleAds[] = await processInBatches(
      domainsToProcess.map((domain: Domain) => async () => {
        try {
          return { domain, ads: await fetchGoogleAds(domain, state.companies, allTokens) };
        } catch (error) {
          logToCloudWatch(`❌ Error fetching Google Ads for domain ${domain.id}: ${error.message}`, "ERROR");
          return { domain, ads: [] };
        }
      }),
      batchSize
    );

    // Filter and prepare ads
    const textfullAds = filterOutTextlessAds(fetchedAdsResults.filter(f => f.ads.length > 0));
    if (!textfullAds?.length) {
      await KF.sendSlackAlert('Google Ads Errors: No textfull ads found', 'C08EPQYR6AC', state.slackToken);
      return 'No textfull ads found';
    }

    const preparedAds = prepareAdsForErrorChecking(textfullAds);
    const errors = {spelling: [] as any[],capitalization: [] as any[] };
      

    // Check for errors
    for (const ad of preparedAds as adsPreparedForErrorDetection[]) {
      [...ad.descriptions, ...ad.headlines].forEach((item) => {
        const location = ad.descriptions.includes(item) ? 'descriptions' : 'headline';
        const baseError = {resource: ad.resourceName,domain: ad.domain,googleAdsId: ad.googleAdsId,wholeSentence: item.text,location};

        const misspelledWords = extractMisspelledWords(item.text, googleAdsIgnoreList);
        if (misspelledWords.length > 0)  errors.spelling.push({ ...baseError, errors: misspelledWords });
         
        const nonCapitalWords = extractNonCapitalLetterWords(item.text, googleAdsNonCapitalLettersIgnoreList).filter(c => !c.includes('CUSTOM'));
        if (nonCapitalWords.length > 0) errors.capitalization.push({ ...baseError, errors: nonCapitalWords });   
        
      });
    }

    // Format and send Slack messages
    const formatSlackTable = (errors: any[], title: string) => {
      const header = "resource                                        | errors   |        domain              | googleAdsId  | wholeSentence                                    | location \n" +
                    "------------------------------------------------|----------|----------------------------|--------------|--------------------------------------------------|-----------\n";
      
      const rows = errors.map(ad => 
        `${ad.resource.padEnd(38)}| ${ad.errors.join(",").padEnd(8)}| ${ad.domain.padEnd(30)}| ${ad.googleAdsId.toString().padEnd(12)}| ${ad.wholeSentence.padEnd(50)}| ${ad.location}`
      ).join('\n');

      return `\`\`\`${header}${rows}\`\`\``;
    };

  
    
   
    await KF.sendSlackAlert('*🚨 Google Ads Content Errors:*', slackChannels.CONTENT, state.slackToken);
    errors.spelling.length > 0 ?
       await KF.sendSlackAlert(formatSlackTable(errors.spelling, 'Spelling Errors'), slackChannels.CONTENT, state.slackToken):
        await KF.sendSlackAlert('🌿 No Spelling Errors Found', slackChannels.CONTENT, state.slackToken);
    

      
      await KF.sendSlackAlert('*🚨Google Ads non-Capital words Errors:*', slackChannels.CONTENT, state.slackToken);
      (errors.capitalization.length > 0)  ?
        await KF.sendSlackAlert(formatSlackTable(errors.capitalization, 'Capitalization Errors'), slackChannels.CONTENT, state.slackToken) :
        await KF.sendSlackAlert('*🌿 No Capitalization Errors Found*', slackChannels.CONTENT, state.slackToken);
    

    return 'ads were processed by local spellchecker and sent to kidon to be sended by slack to content errors channel';
  }



  async findAndFixWebsitesGrammaticalErrors(domainId?: number, batchSize?: number) {
    const state =   this.globalState.getAllState(); 
     let ignoredWords =  await this.kidonClient.raw('select * from configuration where id = ?', ['56']);
     ignoredWords = ignoredWords[0][0].values.split(',')
     ignoredWords = ignoredWords.map(iw => iw.replace(/\s+/g, ''));

     if(!state || !ignoredWords){ logToCloudWatch('No state/ No ignore words found'); }
         // ✅ Step 1: filter non english paths out and assign relevant paths to domains
        const englishPats =  state.paths.filter((p) => !ignoredLanguages.some(lang => p.path.includes(lang)));  //filter out non english paths
         // ✅ Step 2: filter out non visited domains, attach paths to each domain

        const weekAgo = new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0];
        const recentlyVisitedDomains =  await this.kidonClient('tracker_visitors').select('domain_name').where('created_at', '>', weekAgo).whereIn('utm_source', ['GOOGLE', 'BING']).distinct(); 
         if(!recentlyVisitedDomains || recentlyVisitedDomains.length === 0)     logToCloudWatch('no tracker visitors Data!');

        const chosenDomains = domainId ? state.domains.filter((d: Domain) => d.id === domainId) : state.domains.filter(d => recentlyVisitedDomains.some(r => r.domainName === d.hostname));
        chosenDomains.forEach((domain: Domain) => {domain.paths = englishPats.filter((p: Paths) => p.domainId === domain.id).map((p: Paths) => p.path).filter((p)=> p); });  // asign paths per domain
         // ✅ Step 3: fetch all paths' text,   check each word for errors and send result to mail
         const detectedErrors =    await fetchWebsitesInnerHtmlAndFindErrors(chosenDomains, ignoredWords,state); //get inner html of websites
         const domainMessages = createErrorsTable(JSON.stringify(detectedErrors));
         await KF.sendSlackAlert('Web Sites Errors:', slackChannels.CONTENT, state.slackToken);
         
         for (const message of domainMessages) {
             await KF.sendSlackAlert(message, slackChannels.CONTENT, state.slackToken);
         }       
 

        return `websites were processed by local spellchecker and sent to kidon to be sended by slack to content errors channel`;
}
 

  async urlValidation( ){
    try {
    const state =   this.globalState.getAllState(); 
    const res = await getSecretFromSecretManager(process.env.SECRET_NAME);
    const googleKey = JSON.parse(res).GOOGLE_SERVICE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const bq = await KF.connectToBQ(process.env.BQ_EMAIL_SERVICE, googleKey, process.env.BQ_PROJECT_NAME);
    const [job] = await bq.createQueryJob({ query: 'select domain_id,hostname,landing_page from `kidon3_STG.landing_page_performance` group by all', });
    let [rows] = await job.getQueryResults();

    rows = rows.filter(r => r.domain_id !== 188); // test domain

  rows = rows.map((row) => {  // attaching correct hoistname to each row that miss it
    if (row.domain_id == 24) row.hostname = 'topmealkitdelivery';
    if (row.domain_id == 36) row.hostname = '10beststudentloans';
    if(row.domain_id == 46) row.hostname = '10beststudentloans';
    if (row.domain_id == 51) row.hostname = '10bestmortgage';
    if (row.domain_id == 53) row.hostname = '10bestmortgage'; 
    if (row.domain_id == 195) row.hostname = '10bestcasino.amazonslots';
    return row; // ✅ This is the key
  });
  
   let  uncorrectUrls = rows.filter((r)=> !r.landing_page.includes(r.hostname))
   uncorrectUrls = uncorrectUrls.map((uu) => ({ landingpage: uu.landing_page,hostname: uu.hostname}));

   const msg = uncorrectUrls?.length > 0 ?  uncorrectUrls.forEach((uu) => { console.log(`*Landing Page: ${uu.landing_page}, Hostname: ${uu.hostname}*`);}) : '*🌿All URLs are correct*';
   
  
    
  
 
    await KF.sendSlackAlert('Uncorrect URL:', slackChannels.CONTENT, state.slackToken);
    await KF.sendSlackAlert(`${msg}`, slackChannels.CONTENT, state.slackToken);

    
      } catch (error) {
      console.log(error)
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


