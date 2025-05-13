import { Injectable,Logger,Inject,HttpException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
import { fetchGoogleAds,fetchLineups,filterOutTextlessAds,prepareAdsForErrorChecking,fetchWebsitesInnerHtmlAndFindErrors, extractNonCapitalLetterWords, formatGoogleAdsErrors, sendGoogleAdsErrorReports, checkIfLineupExists, processLineupResults } from './utils';
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
import { BigQuery } from '@google-cloud/bigquery';

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


 
 
  async lineupValidation(hostname: string) {
    logToCloudWatch('entering lineupValidation');
  
    try {
      let errors = []
      
      const state = this.globalState.getAllState(); if (!state) return 'No state found';
      let domainsToProcess = state.domains.filter((d: Domain) => d.googleAdsId);
      domainsToProcess = domainsToProcess.filter((d: Domain) =>  ![176,128,153].includes(d.id)  );
      const allTokens = await Promise.all(state.companies.map(async (c) => ({ company: c.name, token: await KF.getGoogleAuthToken(c) })));
  
      const urlSet = new Set<string>();
  
      // ✅ Step 1: fetch lineups
      const rawLineupResults = await processInBatches(
          domainsToProcess.map((domain: Domain) => async () => {
              try {
                  return await fetchLineups(domain, state.companies, allTokens, googleAdsLandingPageQuery);
              } catch (error) {
                  logToCloudWatch(`❌ Error fetching Google Ads for domain ${domain.id}: ${error.message}`, "ERROR");
                  return { domain, results: [] };
              }
          }),
          30
      );
      
      let urlAndSlackChannel = processLineupResults(rawLineupResults);
      logToCloudWatch(`Found ${urlAndSlackChannel.length} lineups`, 'INFO');
      
      if (hostname) {
          urlAndSlackChannel = urlAndSlackChannel.filter((u) => u.url.includes(hostname));
      }
 
      // ✅ Step 2: validate lineups (🔧 CHANGED to use processInBatches)
      const validationResults = await processInBatches( // 🔧 ADDED
        urlAndSlackChannel.map((urlAndSlack) => async () => { // 🔧 ADDED
          let axiosRes, pupeteerRes, durationMs; // 🔧 ADDED
  
          try { // 🔧 ADDED
            logToCloudWatch(`checking ${urlAndSlack.url}  `, 'INFO');
  
            const startTime = Date.now();
            axiosRes = await axios.get(urlAndSlack.url, { timeout: 10000 });
            durationMs = Date.now() - startTime;
          
            const browser = await puppeteer.launch({
              headless: true,
         //     executablePath: '/opt/chrome/chrome-linux64/chrome',
              protocolTimeout: 60000, // 🔧 ADDED
            });
  
            const page = await browser.newPage();
            await page.goto(urlAndSlack.url, { waitUntil: 'networkidle2', timeout: 60000 });
  
            await page.waitForSelector(
              '[class*="partnersArea_main-partner-list"], [class*="ConditionalPartnersList"], [class*="homePage_partners-list-section"], [class*="articlesSection_container"], [class*="partnerNode"], [id*="test-id-partners-list"]',
              { timeout: 5000 }
            ).catch(() => {});
            
            pupeteerRes = await page.content();
            await browser.close();
  
          } catch (err) {
            logToCloudWatch(`Error in lineupValidation: ${err}`, 'ERROR');
            if(err.name === 'AxiosError'){
              return { url: urlAndSlack.url, slackChannelId: urlAndSlack.slackChannelId, campaignName: urlAndSlack.campaignName, status: err.status, reason: 'response status not success (not 200)' }; 
            } else {
              return { url: urlAndSlack.url, slackChannelId: urlAndSlack.slackChannelId, campaignName: urlAndSlack.campaignName, status: err.status, reason: `${JSON.stringify(err)}` };  
            }
          }
  
          if(durationMs > 10000) {
            return { url: urlAndSlack.url, slackChannelId: urlAndSlack.slackChannelId, campaignName: urlAndSlack.campaignName, status: axiosRes.status, reason: 'timeout' };
          }else if(!checkIfLineupExists(pupeteerRes)){
            return { url: urlAndSlack.url, slackChannelId: urlAndSlack.slackChannelId, campaignName: urlAndSlack.campaignName, status: '-', reason: 'no lineup found' }; 
          }
          return null; 
        }),
        3 
      ); 
  
      const filteredErrors = validationResults.filter(Boolean); // 🔧 ADDED
  

      const secondCheckResults = await processInBatches(
        filteredErrors
          .filter(e => e.reason === 'no lineup found')
          .map(error => async () => {
            // Re-fetch the page content
            let pupeteerRes;
            try {
              const browser = await puppeteer.launch({
                headless: true,
                executablePath: '/opt/chrome/chrome-linux64/chrome',
                protocolTimeout: 60000,
              });
              const page = await browser.newPage();
              await page.goto(error.url, { waitUntil: 'networkidle2', timeout: 60000 });
              pupeteerRes = await page.content();
              await browser.close();
            } catch (err) {
              logToCloudWatch(`[SECOND TRY] Puppeteer error for ${error.url}: ${err}`, 'ERROR');
              // If puppeteer fails, treat as still error
              return error;
            }
            // Only return error if checkIfLineupExists still fails
            const exists = checkIfLineupExists(pupeteerRes);
            logToCloudWatch(`[SECOND TRY] checkIfLineupExists for ${error.url}: ${exists}`, 'INFO');
            if (!exists) {
              return error;
            }
            logToCloudWatch(`[SECOND TRY] Lineup found on retry for ${error.url}, overriding previous error.`, 'INFO');
            return null;
          }),
        3
      );
      
      const doubleFailed = [
        ...filteredErrors.filter(e => e.reason !== 'no lineup found'),
        ...secondCheckResults.filter(Boolean)
      ];
      






      if(doubleFailed.length > 0){
        for(let error of filteredErrors){
          const errorMessage = [  '*Lineup Validation Error:*',  `*URL:* ${error.url}`,`*Campaign:* ${error.campaignName}`,`*Status:* ${error.status}`,`*Reason:* ${error.reason}` ].join('\n');
          logToCloudWatch(`Lineup Validation Errors: ${errorMessage}`, 'ERROR');
          await KF.sendSlackAlert(errorMessage, slackChannels.PERSONAL, state.slackToken); 
        }
      }else{
        logToCloudWatch(`no lineup errors found`);
        await KF.sendSlackAlert(`no lineup errors found`,  slackChannels.PERSONAL, state.slackToken); 
      }
  
    } catch (e) {
      logToCloudWatch(`Error during lineupValidation: ${e}`, 'ERROR');
      return `Error during lineupValidation ${JSON.stringify(e)}`;
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

 
  async mobileAndDesktopTrafficCongruenceValidation(){
    try {    
      const state =   this.globalState.getAllState(); 

      const result = await this.kidonClient.raw('SELECT campaign_id, domain_name, COUNT(*) AS clicks FROM tracker_visitors WHERE device = "mobile" AND DATE(created_at) = CURDATE() - INTERVAL 1 DAY GROUP BY campaign_id, domain_name HAVING COUNT(*) > 5' );   
      logToCloudWatch(`result: ${JSON.stringify(result)}`, "INFO", 'mobile and desktop traffic congruence validation');
      const campaignIds = result[0].map(r => Number(r.campaign_id));
       const ids = campaignIds.join(',');
       //   const ids = ['22386145648','21388459597','17268271860']
      logToCloudWatch(`ids: ${ids}`, "INFO", 'mobile and desktop traffic congruence validation');
 
 
      const res = await getSecretFromSecretManager(process.env.SECRET_NAME);
      const googleKey = JSON.parse(res).GOOGLE_SERVICE_PRIVATE_KEY.replace(/\\n/g, '\n');
      logToCloudWatch(`googleKey: ${googleKey}`, "INFO", 'mobile and desktop traffic congruence validation');
      logToCloudWatch(`BQ_EMAIL_SERVICE: ${process.env.BQ_EMAIL_SERVICE} BQ_PROJECT_NAME: ${process.env.BQ_PROJECT_NAME}`, "INFO", 'mobile and desktop traffic congruence validation');

      const credentials = { client_email: process.env.BQ_EMAIL_SERVICE, private_key: googleKey };
      const bq =   new BigQuery({ credentials, projectId: process.env.BQ_PROJECT_NAME });


     // const bq = await KF.connectToBQ(process.env.BQ_EMAIL_SERVICE, googleKey, process.env.BQ_PROJECT_NAME);
      const [job] = await bq.createQueryJob({ query: `select * from kidon3_STG.campaigns_name_network WHERE campaign_id IN (${ids})` });
      let [rows] = await job.getQueryResults();

      rows.forEach(r => {
        const match = result[0].find(re => Number(re.campaign_id) === Number(r.campaign_id));
        r.domain_name = match ? match.domain_name : '';
      });

      logToCloudWatch(`rows: ${JSON.stringify(rows)}`, "INFO", 'mobile and desktop traffic congruence validation');
     const desktopOnlyTraffick = /^(?!.*\([^)]*[MT\d][^)]*\)).*\(\s*D\s*\).*$/; // reject any parentheses that contain M, T or a digit, require a standalone "(D)" somewhere
     const incongruentTraffick = rows.filter(name=>desktopOnlyTraffick.test(name.campaign_name))
     logToCloudWatch(`incongruentTraffick: ${JSON.stringify(incongruentTraffick)}`, "INFO", 'mobile and desktop traffic congruence validation');

      // Deduplicate by campaign_id and campaign_name
      const uniqueErrors = [];
      const seen = new Set();
      for (const c of incongruentTraffick) {
        const key = `${c.campaign_id}||${c.campaign_name}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueErrors.push(c);
        }
      }


     if (uniqueErrors.length > 0) {
      const formatted = uniqueErrors.map(c =>
        `• *Campaign:* ${c.campaign_name}\n  *Campaign ID:* ${c.campaign_id}\n  *Domain:* ${c.domain_name}\n  *Device:* ${c.device}\n  *Date:* ${c.date?.value}\n  *Source:* ${c.media_source}\n  *Network:* ${c.network_type}\n`
      ).join('\n');
      await KF.sendSlackAlert(`*Incongruent Traffick campaign names:*\n${formatted}`, slackChannels.CONTENT, state.slackToken);
    } else {
      await KF.sendSlackAlert('No incongruent traffick found', slackChannels.CONTENT, state.slackToken);
    }

     return 'mobile and desktop traffic congruence validation finished';
     } catch (error) {
 
      logToCloudWatch(`❌ Error in mobileAndDesktopTrafficCongruenceValidation: ${error.message} |||||| ${JSON.stringify(error)}`, "ERROR", 'mobile and desktop traffic congruence validation');
      return `Error in mobileAndDesktopTrafficCongruenceValidation: ${error.message}`;
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


