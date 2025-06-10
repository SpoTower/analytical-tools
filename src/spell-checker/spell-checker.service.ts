import { Injectable,Logger,Inject,HttpException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
import { fetchGoogleAds,fetchLineups,filterOutTextlessAds,prepareAdsForErrorChecking,fetchWebsitesInnerHtmlAndFindErrors, extractNonCapitalLetterWords, formatGoogleAdsErrors, sendGoogleAdsErrorReports, checkIfLineupExists, processLineupResults, getActiveBingUrls, fetchAllTransactions, establishInvocaConnection, isLocal, generateBrowser, checkInvocaInMobile, checkInvocaInDesktop, getTrafficIncongruence, assignDomainNames, getUniqueCampaignErrors, sendTrafficValidationAlerts } from './utils';
import { extractErrorsWithLocalLibrary, extractErrorsWithGpt } from './utilsOfUtils';
import { GlobalStateService } from 'src/globalState/global-state.service';
import { GptService } from 'src/gpt/gpt.service';
const logger = new Logger('analytical-tools.spellchecker');
import {logToCloudWatch} from 'src/logger'; 
import {adsPreparedForErrorDetection, BqTrafficCampaign,googleAdsAndDomain,CampaignAndUrlInfo} from './interfaces';
import { Domain,Paths } from 'src/kidonInterfaces/shared';
import {processInBatches,extractMisspelledWords,extractOutdatedYears} from './utils';
import {googleAds } from './interfaces';
export {emailSubjects} from './consts';
import * as KF from '@spotower/my-utils';
import {ignoredLanguages} from './ignoreWords';
import { KIDON_CONNECTION } from 'src/knex/knex.module';
import { Knex } from 'knex';
import { createErrorsTable } from './utils';
import { slackChannels} from './consts';
import { getSecretFromSecretManager } from 'src/utils/secrets';
import {googleAdsGrammarErrors,googleAdsLandingPageQuery} from './gaqlQuerys';
import { fetchIgnoreWords } from './utils';
import axios from 'axios';
import { AnyObject } from './consts';
import puppeteer from 'puppeteer';
import { extractBaseUrl } from './utils';
import { campaignsNetworks, traffic } from './queries/traffic';
 @Injectable()
export class SpellCheckerService {

  constructor(
    @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,
    private readonly globalState: GlobalStateService,
    private readonly gptService: GptService
  ) {}
 
 
  async findAndFixGoogleAdsGrammaticalErrors(batchSize: number, domainId?: number, sliceSize?: number    ) {
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


 
 
  async lineupValidation(hostname: string, isTest:boolean, url:string) {
    logToCloudWatch('entering lineupValidation');
  
    try {
      let errors = []
      
      const state = this.globalState.getAllState(); if (!state) return 'No state found';
      let domainsToProcess = state.domains.filter((d: Domain) => d.googleAdsId);
      domainsToProcess = domainsToProcess.filter((d: Domain) =>  ![20,176,128,153,34,17,31,40,4,25,21,115,61,43,68,66,59,122,163,147,183,207,197].includes(d.id)  );
      const allTokens = await Promise.all(state.companies.map(async (c) => ({ company: c.name, token: await KF.getGoogleAuthToken(c) })));
  
      const urlSet = new Set<string>();
  
      // ✅ Step 1: fetch lineups
      const rawLineupResults : googleAdsAndDomain[] = await processInBatches(
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
      
      let urlAndSlackChannel : CampaignAndUrlInfo[]  = processLineupResults(rawLineupResults);
      logToCloudWatch(`Found ${urlAndSlackChannel.length} lineups`, 'INFO');
      
      if (hostname) urlAndSlackChannel = urlAndSlackChannel.filter((u) => u.url.includes(hostname));
      if(url)urlAndSlackChannel = urlAndSlackChannel.filter((u) => u.url.includes(url));
        
      
 
      // ✅ Step 2: validate lineups and check for errors
      const validationResults = [];
      for (const urlAndSlack of urlAndSlackChannel) {
        let axiosRes, pupeteerRes, durationMs, pageContent, pageTitle;
        try {
          logToCloudWatch(`checking ${urlAndSlack.url}  `, 'INFO');
          const startTime = Date.now();
          axiosRes = await axios.get(urlAndSlack.url, { timeout: 10000 });
          durationMs = Date.now() - startTime;
          const browser = await generateBrowser()
          const page = await browser.newPage();
          await page.goto(urlAndSlack.url, { waitUntil: 'networkidle2', timeout: 60000 });
          await new Promise(resolve => setTimeout(resolve, 2000));
          await page.waitForSelector(
            '[class*="partnersArea_main-partner-list"], [class*="ConditionalPartnersList"], [class*="homePage_partners-list-section"], [class*="articlesSection_container"], [class*="partnerNode"], [id*="test-id-partners-list"]',
            { timeout: 5000 }
          ).catch(() => {});
          
          // Get page content for error checking
          pageContent = await page.evaluate(() => document.body.innerText);
          pageTitle = await page.title();
          pupeteerRes = await page.content();
          await browser.close();

          // Check for errors in the page content
          const pageData = {
            domain: domainsToProcess.find(d => urlAndSlack.url.includes(d.hostname))?.id || 0,
            fullPath: urlAndSlack.url,
            innerHtml: pageContent,
            titleElement: pageTitle,
            detectedErrors: [],
            outdatedYears: []
          };

          // Get ignore list from database
          const [ignoreList] = await Promise.all([
            fetchIgnoreWords(this.kidonClient, '59')
          ]);

          // Check for errors
          const pageWithLocalErrors = extractErrorsWithLocalLibrary([pageData], ignoreList)[0];
          const pageWithAllErrors = await extractErrorsWithGpt(this.gptService, [pageWithLocalErrors], ignoreList);

          if (pageWithAllErrors[0].detectedErrors.length > 0 || pageWithAllErrors[0].outdatedYears.length > 0) {
            validationResults.push({ 
              url: urlAndSlack.url, 
              slackChannelId: urlAndSlack.slackChannelId, 
              campaignName: urlAndSlack.campaignName, 
              status: axiosRes.status, 
              reason: 'content errors found',
              localErrors: pageWithAllErrors[0].detectedErrors,
              outdatedYears: pageWithAllErrors[0].outdatedYears
            });
          }

        } catch (err) {
          logToCloudWatch(`Error in lineupValidation: ${err}`, 'ERROR');
          if (err.name === 'AxiosError'  && err.status != undefined) {
            validationResults.push({ url: urlAndSlack.url, slackChannelId: urlAndSlack.slackChannelId, campaignName: urlAndSlack.campaignName, status: err.status, reason: `${JSON.stringify(err)}` });
            continue;
          } else {
            continue;
          }
        }
        if (durationMs > 10000) {
          validationResults.push({ url: urlAndSlack.url, slackChannelId: urlAndSlack.slackChannelId, campaignName: urlAndSlack.campaignName, status: axiosRes.status, reason: 'timeout' });
        } else if (!checkIfLineupExists(pupeteerRes)) {
          validationResults.push({ url: urlAndSlack.url, slackChannelId: urlAndSlack.slackChannelId, campaignName: urlAndSlack.campaignName, status: '-', reason: 'no lineup found' });
        }
      }
  
      const filteredErrors = validationResults.filter(Boolean);
  
      const secondCheckResults = await processInBatches(
        filteredErrors
          .filter(e => e.reason === 'no lineup found')
          .map(error => async () => {
            // Re-fetch the page content
            let pupeteerRes;
            try {
              const browser = await puppeteer.launch({
                headless: true,
                   executablePath: '/usr/local/bin/chrome', // the location of chrome on the ec2
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
      
      let doubleFailed = [
        ...filteredErrors.filter(e => e.reason !== 'no lineup found'),
        ...secondCheckResults.filter(Boolean)
      ];
      
      if(doubleFailed && doubleFailed.length > 0){
        for(let error of filteredErrors){
          let errorMessage = [  ' :rotating_light:  *Lineup Validation Error:*',  `*URL:* ${error.url}`,`*Campaign:* ${error.campaignName}`,`*Status:* ${error.status}`,`*Reason:* ${error.reason}` ];
          
          // Add content errors to the message if they exist
          if (error.localErrors?.length > 0) {
            errorMessage.push('*Local Library Errors:*', ...error.localErrors.map(e => `- ${e}`));
          }
          if (error.outdatedYears?.length > 0) {
            errorMessage.push('*Outdated Years:*', ...error.outdatedYears.map(e => `- ${e}`));
          }

          const finalMessage = errorMessage.join('\n');
          logToCloudWatch(`Lineup Validation Errors: ${finalMessage}`, 'ERROR');
          await KF.sendSlackAlert(finalMessage, isTest ?  slackChannels.PERSONAL : slackChannels.CONTENT, state.slackToken); 
        }
      }else{
        logToCloudWatch(`:herb: No Lineup errors found`);
        await KF.sendSlackAlert(`no lineup errors found`,  isTest ?  slackChannels.PERSONAL : slackChannels.CONTENT, state.slackToken); 
      }
  
    } catch (e) {
      logToCloudWatch(`Error during lineupValidation: ${e}`, 'ERROR');
      return `Error during lineupValidation ${JSON.stringify(e)}`;
    }
  }
  


  async activeUrls(hostname: string, onlyOriginalUrl: boolean) {
    const state = this.globalState.getAllState(); if (!state) return 'No state found';


   // const activeBingUrls = await getActiveBingUrls(state);
  //  logToCloudWatch(`Active Bing URLs: ${JSON.stringify(activeBingUrls)}`, 'INFO');


    let domainsToProcess = state.domains.filter((d: Domain) => d.googleAdsId);
     const allTokens = await Promise.all(state.companies.map(async (c) => ({ company: c.name, token: await KF.getGoogleAuthToken(c) })));

 
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

    if(!onlyOriginalUrl){
       return urlAndSlackChannel.map((u) => u.url);
    }

    const baseUrlSet = new Set<string>();
    for (const obj of urlAndSlackChannel) {
       const match = obj.url.match(/^(https:\/\/[^\/]+\.com\/)/);
      if (match) {
        baseUrlSet.add(match[1]);
      }
    }
    return Array.from(baseUrlSet) ;
   }
  
  
 
  async findAndFixWebsitesGrammaticalErrors(domainId?: number,   isTest?: boolean, url?: string) {
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
         const detectedErrors =    await fetchWebsitesInnerHtmlAndFindErrors(chosenDomains, ignoredWords, this.gptService, url); //get inner html of websites
         const domainMessages = createErrorsTable(JSON.stringify(detectedErrors));
          await KF.sendSlackAlert('Web Sites Errors:', slackChannels.CONTENT, state.slackToken);
         
         if(!isTest){
          for (const message of domainMessages) {
             await KF.sendSlackAlert(message, slackChannels.CONTENT, state.slackToken);
         }       
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

 
  async mobileAndDesktopTrafficCongruenceValidation(isTest:boolean){
    try {    
      const state =   this.globalState.getAllState(); 


      // ✅ Step 1: fetch mobile and desktop traffic (campaign id's from tracker visitors aurora table)

     const [mobileTraffic, desktopTraffic] = await Promise.all([
        this.kidonClient.raw(traffic('mobile') ),   
        this.kidonClient.raw(traffic('desktop') )
      ]) 
      
 
      const mobileCampaignIds : number[] = mobileTraffic[0].map(m => Number(m.campaign_id));
      const desktopCampaignIds : number[] = desktopTraffic[0].map(d => Number(d.campaign_id));
      
       const mobileIds = mobileCampaignIds.join(',');
      const desktopIds = desktopCampaignIds.join(',');


 
  
 

      // ✅ Step 2: fetch campaign names and networks from BQ

      const res = await getSecretFromSecretManager(process.env.SECRET_NAME);
      const googleKey = JSON.parse(res).GOOGLE_SERVICE_PRIVATE_KEY.replace(/\\n/g, '\n');
       const bq = await KF.connectToBQ(process.env.BQ_EMAIL_SERVICE, googleKey, process.env.BQ_PROJECT_NAME);


      const [job] = await bq.createQueryJob({ query: campaignsNetworks(mobileIds) });
      let [bqCampaignsTrafficMobile] = await job.getQueryResults() as [BqTrafficCampaign[]];; // bq parallels for what supposed to be mobile only traffick that not contains sole D/(D)
 

      const [job2] = await bq.createQueryJob({ query: campaignsNetworks(desktopIds) });
      let [bqCampaignsTrafficDesktop]  = await job2.getQueryResults() as [BqTrafficCampaign[]]; // bq parallels for what supposed to be desktop only traffick that not contains sole M/(M)

      logToCloudWatch(`bqCampaignsTrafficMobile: ${JSON.stringify(bqCampaignsTrafficMobile.map((c)=>c.campaign_name))}` , "INFO", 'mobile and desktop traffic congruence validation');
      logToCloudWatch(`bqCampaignsTrafficDesktop: ${JSON.stringify(bqCampaignsTrafficDesktop.map((c)=>c.campaign_name))}` , "INFO", 'mobile and desktop traffic congruence validation');

    // ✅ Step 2: attach domain name from aurora table to each campaign from BQ
      assignDomainNames(bqCampaignsTrafficMobile, bqCampaignsTrafficDesktop, mobileTraffic[0], desktopTraffic[0]);

      // ✅ Step 3: filter out campaigns that are only in desktop traffic / mobile traffic / invalid campaigns names

      const { incongruentMobileDesctopTraffick,incongruentDesctopMobileTraffick, invalidCampaigns} = getTrafficIncongruence(bqCampaignsTrafficMobile, bqCampaignsTrafficDesktop);
       
        
       
      
      //const incongruentTraffick = bqCampaignsTraffic.filter((c)=>desktopOnlyTraffick.test(c.campaign_name))
     logToCloudWatch(`incongruentTraffic: ${JSON.stringify(incongruentMobileDesctopTraffick)}`, "INFO", 'mobile and desktop traffic congruence validation');

      // Deduplicate by campaign_id and campaign_name
      const uniqueErrorsMobile = getUniqueCampaignErrors(incongruentMobileDesctopTraffick);
      const uniqueErrorsDesktop = getUniqueCampaignErrors(incongruentDesctopMobileTraffick);
      const uniqueErrorsInvalid = getUniqueCampaignErrors(invalidCampaigns);  

   await sendTrafficValidationAlerts(uniqueErrorsMobile, uniqueErrorsDesktop, uniqueErrorsInvalid, isTest, state);


     return 'mobile and desktop traffic congruence validation finished';
     } catch (error) {

      logToCloudWatch(`❌ Error in mobileAndDesktopTrafficCongruenceValidation: ${error.message} |||||| ${JSON.stringify(error)}`, "ERROR", 'mobile and desktop traffic congruence validation');
      return `Error in mobileAndDesktopTrafficCongruenceValidation: ${error.message}`;
    }
  }


// url used if we want to check a specific url (1)
  async invocaLineupValidation(hostname: string, url:string, isTest:boolean) {
        logToCloudWatch(`entering invoca lineup validation`, "INFO", 'invoca lineup validation');
        const state =   this.globalState.getAllState(); 
        await establishInvocaConnection();
        const transactions = await  fetchAllTransactions();
       const landingpages =  !isLocal() ? transactions.filter((tr)=>tr.landing_page).map((trl)=>trl.landing_page) : transactions.filter((tr)=>tr.landing_page).slice(0,5).map((trl)=>trl.landing_page) ;
       let uniqueLandingpages :string[] = Array.from(new Set(landingpages.map(extractBaseUrl).filter(Boolean)));
        let domains = await this.kidonClient.raw('select * from domain') ;
        domains = domains[0].map((d:Domain)=>d.hostname)
        uniqueLandingpages = uniqueLandingpages.filter(lp =>!domains.some(d => lp.includes(d)));
          
             
    let invoclessPages = [];
    let invoclessPagesMobile = [];
    try {
      const landingpagesToCheck = url ? [url] : uniqueLandingpages; // if url is provided, we only check that url
      for (const landingpage of landingpagesToCheck) {
          logToCloudWatch(`Processing landingpage (m+d): ${landingpage}`, "INFO", 'invoca lineup validation');
          const [isInvoca, isInvocaMobile] = await Promise.all([checkInvocaInDesktop(landingpage),checkInvocaInMobile(landingpage)]);
          if (isInvoca && isInvoca.length === 0) invoclessPages.push(landingpage);
          if ((isInvocaMobile && isInvocaMobile.length === 0)  )invoclessPagesMobile.push(landingpage);
    }
      
       logToCloudWatch(`invoclesspages: ${invoclessPages}`, "INFO", 'invoca lineup validation');
      
       if(invoclessPages.length > 0 && !isTest){
        await KF.sendSlackAlert(`*🚨Invoca Desktop Lineup Validation (no invoca tag in page scripts):*\n${invoclessPages.join('\n')}`, slackChannels.CONTENT, state.slackToken);
       }else{
        await KF.sendSlackAlert('*🌿Invoca Desktop Lineup Validation:*\nNo invoca pages found', slackChannels.CONTENT, state.slackToken);
       }

       if(invoclessPagesMobile.length > 0 && !isTest){
        await KF.sendSlackAlert(`*🚨Invoca Mobile Lineup Validation (no invoca tag in page scripts):*\n${invoclessPagesMobile.join('\n')}`, slackChannels.CONTENT, state.slackToken);
       }else{
        await KF.sendSlackAlert('*🌿Invoca Mobile Lineup Validation:*\nNo invoca pages found', slackChannels.CONTENT, state.slackToken);
       }

       return 'invoca lineup validation finished'; 
      } catch (error) {
        logToCloudWatch(`❌ Error in invocaLineupValidation: ${error.message} |||||| ${JSON.stringify(error)}`, "ERROR", 'invoca lineup validation');
        return `Error in invocaLineupValidation: ${error.message}`;
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


