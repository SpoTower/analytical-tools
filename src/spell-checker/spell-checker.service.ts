import { Injectable,Logger,Inject,HttpException } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
import { fetchGoogleAds,fetchLineupAds,filterOutTextlessAds,prepareAdsForErrorChecking,fetchWebsitesInnerHtmlAndFindErrors, extractNonCapitalLetterWords, formatGoogleAdsErrors, sendGoogleAdsErrorReports, checkIfLineupExists } from './utils';
import { GlobalStateService } from 'src/globalState/global-state.service';
const logger = new Logger('analytical-tools.spellchecker');
import { logToCloudWatch } from 'src/logger'; 
import {adsPreparedForErrorDetection} from './interfaces';
import { Domain,Paths } from 'src/kidonInterfaces/shared';
import {processInBatches,extractMisspelledWords,extractOutdatedYears} from './utils';
import {googleAds } from './interfaces';
export {emailSubjects} from './consts';
import * as KF from '@spotower/my-utils';
import {ignoredLanguages} from './ignoreWords';
import { KIDON_CONNECTION } from 'src/knex/knex.module';
import { Knex } from 'knex';
import { createErrorsTable } from './utils';
import {slackChannels} from './consts';
import { getSecretFromSecretManager } from 'src/utils/secrets';
import {googleAdsGrammarErrors,googleAdsLandingPageQuery} from './gaqlQuerys';
import { fetchIgnoreWords } from './utils';
import axios from 'axios';
import { AnyObject } from './consts';
import puppeteer from 'puppeteer';
@Injectable()
export class SpellCheckerService {

  constructor(
    @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,
    private readonly globalState: GlobalStateService,
     ) {}


 
  async findAndFixGoogleAdsGrammaticalErrors(batchSize: number, domainId?: number, sliceSize?: number) {
    logToCloudWatch('entering findAndFixGoogleAdsGrammaticalErrors');
    const [googleAdsIgnoreList, googleAdsNonCapitalLettersIgnoreList] = await Promise.all([fetchIgnoreWords(this.kidonClient, '59'),fetchIgnoreWords(this.kidonClient, '60')]);
    const state = this.globalState.getAllState();
    if (!state) return 'No state found';
    // Filter and slice domains
    let domainsToProcess = state.domains.filter((domain: Domain) => domain.googleAdsId).filter((domain: Domain) => !domainId || domain.id === domainId).slice(0, sliceSize || Infinity);
    // Get Google tokens for all companies
    const allTokens = await Promise.all(state.companies.map(async (c) => ({ company: c.name, token: await KF.getGoogleAuthToken(c) })));

    // Fetch Google Ads in batches
    const fetchedAdsResults: googleAds[] = await processInBatches(
      domainsToProcess.map((domain: Domain) => async () => {
        try {
          return { domain, ads: await fetchGoogleAds(domain, state.companies, allTokens, googleAdsGrammarErrors) };
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
    const errors = { spelling: [] as any[], capitalization: [] as any[], outdatedYears: [] as any[] };

    // Check for errors
    for (const ad of preparedAds as adsPreparedForErrorDetection[]) {
      [...ad.descriptions, ...ad.headlines].forEach((item) => {
        const location = ad.descriptions.includes(item) ? 'descriptions' : 'headline';
        const baseError = { resource: ad.resourceName, domain: ad.domain, googleAdsId: ad.googleAdsId, wholeSentence: item.text, location };

        const misspelledWords = extractMisspelledWords(item.text, googleAdsIgnoreList);
        if (misspelledWords.length > 0) errors.spelling.push({ ...baseError, errors: misspelledWords });

        const nonCapitalWords = extractNonCapitalLetterWords(item.text, googleAdsNonCapitalLettersIgnoreList).filter(c => !c.includes('CUSTOM'));
        if (nonCapitalWords.length > 0) errors.capitalization.push({ ...baseError, errors: nonCapitalWords });

        const outdatedYears = extractOutdatedYears(item.text);
        if (outdatedYears.length > 0) errors.outdatedYears.push({ ...baseError, errors: outdatedYears });
      });
    }

    await sendGoogleAdsErrorReports(errors, state);

    return 'ads were processed by local spellchecker and sent to kidon to be sended by slack to content errors channel';
  }


 
 
  async lineupValidation() {
    logToCloudWatch('entering lineupValidation');
 
 




    try {
      let errors = []
       
      const state = this.globalState.getAllState(); if (!state) return 'No state found';
      let domainsToProcess = state.domains.filter((d: Domain) => d.googleAdsId);
      domainsToProcess = domainsToProcess.filter((d: Domain) =>  ![176,128,153].includes(d.id)  );
      const allTokens = await Promise.all(state.companies.map(async (c) => ({ company: c.name, token: await KF.getGoogleAuthToken(c) })));
 
      const urlSet = new Set<string>();

      await processInBatches(
          domainsToProcess.map((domain: Domain) => async () => {
              try {
                  await fetchLineupAds(domain, state.companies, allTokens, googleAdsLandingPageQuery, urlSet);
              } catch (error) {
                  logToCloudWatch(`❌ Error fetching Google Ads for domain ${domain.id}: ${error.message}`, "ERROR");
              }
          }),
          30
      );
      let urlAndSlackChannel : {url: string, slackChannelId: string}[] = urlSet.size > 0 ? Array.from(urlSet).map((u)=>({url:u?.split(' - ')[0], slackChannelId:u?.split(' - ')[1]})) : [];
         
 
      for (const urlAndSlack of urlAndSlackChannel) {
        
        const startTime = Date.now();
        let axiosRes = await axios.get(urlAndSlack.url);
        const durationMs = Date.now() - startTime;

        const browser = await puppeteer.launch({
          headless: true,
          executablePath: '/home/webapp/.cache/puppeteer/chrome/linux-136.0.7103.49/chrome-linux64/chrome',
        });
          const page = await browser.newPage();
          await page.goto(urlAndSlack.url, { waitUntil: 'networkidle2', timeout: 60000 });
          const pupeteerRes = await page.content();      
          await browser.close();
       


        logToCloudWatch(`checking ${urlAndSlack.url}  `, 'INFO');
        if(axiosRes.status !== 200) {
           errors.push({url:urlAndSlack.url, slackChannelId:urlAndSlack.slackChannelId, status: axiosRes.status, reason: 'response status not success (not 200)'});
        }else if(durationMs > 10000) {
          errors.push({url:urlAndSlack.url, slackChannelId:urlAndSlack.slackChannelId, status: axiosRes.status, reason: 'timeout'});
        }else if(!checkIfLineupExists(pupeteerRes)){
          errors.push({url:urlAndSlack.url, slackChannelId:urlAndSlack.slackChannelId, status: '-', reason: 'no lineup found'});
        }
       }

       if(errors.length > 0){
        logToCloudWatch(`Lineup Validation Errors: ${JSON.stringify(errors)}`, 'ERROR');
       // await KF.sendSlackAlert('Lineup Validation Errors:', slackChannels.CONTENT, state.slackToken); 
       }else{
        logToCloudWatch(`no lineup errors found`);
       }

    } catch (e) {
      logToCloudWatch(`Error during lineupValidation: ${e}`, 'ERROR');
        return 'Validation failed';
      }
  }


  async findAndFixWebsitesGrammaticalErrors(domainId?: number, batchSize?: number) {
    const state = this.globalState.getAllState();
    const ignoredWords = await fetchIgnoreWords(this.kidonClient, '56');

    if (!state || !ignoredWords.length) {
      logToCloudWatch('No state/No ignore words found');
      return;
    }

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
    logToCloudWatch (`entering url checker:   `, "INFO", 'url checker');

    try {
    const state =   this.globalState.getAllState(); 
    const res = await getSecretFromSecretManager(process.env.SECRET_NAME);
    const googleKey = JSON.parse(res).GOOGLE_SERVICE_PRIVATE_KEY.replace(/\\n/g, '\n');
    const bq = await KF.connectToBQ(process.env.BQ_EMAIL_SERVICE, googleKey, process.env.BQ_PROJECT_NAME);
    const [job] = await bq.createQueryJob({ query: 'select domain_id,hostname,landing_page from `kidon3_STG.landing_page_performance` group by all', });
    let [rows] = await job.getQueryResults();

    rows = rows.filter(r => r.domain_id !== 188); // test domain
    logToCloudWatch (`rows : ${rows ? rows.length : 0} `, "INFO", 'url checker');

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

   const msg = uncorrectUrls?.length > 0 ?  uncorrectUrls.forEach((uu) => { `*Landing Page: ${uu.landing_page}, Hostname: ${uu.hostname}*`;}) : '*🌿All URLs are correct*';
   logToCloudWatch (`msg : ${msg} `, "INFO", 'url checker');

  
    
  
 
    await KF.sendSlackAlert('Uncorrect URL:', slackChannels.CONTENT, state.slackToken);
    await KF.sendSlackAlert(`${msg}`, slackChannels.CONTENT, state.slackToken); 
    return ` url validation function find ${uncorrectUrls ? uncorrectUrls.length : 0} invalid url's `
    
      } catch (error) {
        logToCloudWatch (`❌ Error in urlValidation: ${error.message}`, "ERROR", 'url checker');
         throw new HttpException('Error processing AB Test events', error?.status || 500);
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


