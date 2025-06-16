import axios from 'axios';
import { AnyObject, hasMobileOrDesktop, mobileOnlyTraffick, desktopOnlyTraffick, urlsWithParams } from './consts';
import { logToCloudWatch } from 'src/logger';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { GptService } from 'src/gpt/gpt.service';
import {BqTrafficCampaign, CategorizedErrors, googleAdsAndDomain, SqlCampaignTraffic, WebsiteError, websiteText} from './interfaces';
import { Domain } from 'src/kidonInterfaces/shared';
import { Company } from 'src/kidonInterfaces/shared';
import { gptProposal } from './interfaces';
import JSON5 from 'json5';
import { getDateRange } from 'src/utils';
import spellchecker from 'spellchecker';
import fs from 'fs';
import path from 'path';
const cheerio = require('cheerio');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');
import * as KF from '@spotower/my-utils';
import {slackChannels} from './consts';
import { log } from 'console';
import { XMLParser } from 'fast-xml-parser';
import { googleAdsLandingPageQuery } from './gaqlQuerys';
import dayjs from 'dayjs';
import { invocaColumns } from './consts';
import puppeteer from 'puppeteer';
import { extractErrorsWithGpt, extractErrorsWithLocalLibrary } from './utilsOfUtils';

export async function fetchGoogleAds(domain: Domain, companies: Company[], tokens:any, query:string ) {
    logToCloudWatch(`Entering fetchGoogleAds, fetching google ads for domain ${domain.id}`);
    console.log(companies.find((c)=>c.id == domain.companyId ).name);
    const date = getDateRange(1, 'YYYY-MM-DD');
    if(query.includes('<startDate>') && query.includes('<endDate>')) {
        query = query.replace('<startDate>', date.startDate).replace('<endDate>', date.endDate);
    }

    try {
        const changeEventResult = await axios.post(
            `https://googleads.googleapis.com/v19/customers/${domain.googleAdsId}/googleAds:searchStream`,
            {
                query: query,
            },
            {
                headers: {
                    'developer-token': companies.find((c)=>c.id == domain.companyId ).googleDeveloperToken,
                    Authorization: `Bearer ${tokens.find((t) => t.company ==  companies.find((c)=>c.id == domain.companyId ).name ).token}`,
                    'login-customer-id': companies.find((c)=>c.id == domain.companyId ).googleCustomerId,
                },
            }
        );
        if (!changeEventResult?.data || !Array.isArray(changeEventResult.data)) {
            logToCloudWatch(`⚠ Unexpected response for domain ${domain.id}: ${JSON.stringify(changeEventResult?.data, null, 2)}`);
            return [];
        }

        if (changeEventResult.data.length === 0) {
            logToCloudWatch(`⚠ No data returned for domain ${domain.id}`);
            return [];
        }

        if (!changeEventResult.data[0]?.results) {
            logToCloudWatch(`⚠ No results in first data object for domain ${domain.id}, Full Response: ${JSON.stringify(changeEventResult.data, null, 2)}`);
            return [];
        }


        return changeEventResult?.data[0]?.results || [];
    } catch (error) {
         const msg = extractInfoFromGoogleAdsError(error);
         logToCloudWatch(`Error fetching google ads for domain ${domain.id}: ${msg}`);
        if (msg.includes(`The customer account can't be accessed because it is not yet enabled or has been deactivated)`) ||
            msg.includes(`Request contains an invalid argument., Invalid customer ID ''.`) ||
            msg.includes(`The caller does not have permission, The customer account can't be accessed because it is not yet enabled or has been deactivated`)
        )  throw new BadRequestException(msg)
        else throw new InternalServerErrorException(msg);
    }
}




    export async function fetchGoogleSearchUrls(domain: Domain, companies: Company[], tokens:any, query:string): Promise<any> {
        const landingPageResult = await axios.post(
            `https://googleads.googleapis.com/v19/customers/${domain.googleAdsId}/googleAds:searchStream`,
            {
                query: query,
            },
            {
                headers: {
                    'developer-token': companies.find((c)=>c.id == domain.companyId ).googleDeveloperToken,
                    Authorization: `Bearer ${tokens.find((t) => t.company ==  companies.find((c)=>c.id == domain.companyId ).name ).token}`,
                    'login-customer-id': companies.find((c)=>c.id == domain.companyId ).googleCustomerId,
                },
            }
        );
        
        return {
            domain,
            results: landingPageResult?.data[0]?.results || []
        };
    }

    export function extractGoogleSearchUrls(rawResults: googleAdsAndDomain[]): {url: string, slackChannelId: string, campaignName: string}[] {
        const urlSet = new Set<string>();
        const processedResults: {url: string, slackChannelId: string, campaignName: string}[] = [];
        
        rawResults.forEach(({domain, results}) => {
            if (results && results.length > 0) {
                results.forEach((r) => {
                    const urls = r?.adGroupAd?.ad?.finalUrls;
                    const campaignName = r?.campaign?.name || 'Unknown Campaign';
                    urls?.forEach(url => {
                        if (!urlSet.has(url)) {
                            urlSet.add(url);
                            processedResults.push({
                                url: url,
                                slackChannelId: domain?.slackChannelId,
                                campaignName: campaignName
                            });
                        }
                    });
                });
            }
        });
        
        return processedResults;
    }


export function filterOutTextlessAds(result: AnyObject[]) {
    return result?.map((r: AnyObject) => ({...r,ads: r.ads?.filter(ad => ad.changeEvent?.newResource?.ad?.responsiveSearchAd) || []}))
 
}

export function extractInfoFromGoogleAdsError(error: any) {
    return `${error.message}, ${error.response.data[0].error.message}, ${error.response.data[0].error.details[0].errors[0].message}  `;
}

export function prepareAdsForErrorChecking(textfullAds: Record<string, any>[]) {
    logToCloudWatch(`Entering prepareAdsForGpt, found ${textfullAds?.length} ads`);

    const ads = textfullAds.flatMap((t) => {
        const domainName = t.domain?.hostname;  
        const googleAdsId = t.domain?.googleAdsId; //  

        return t.ads.map((ad: Record<string, any>) => ({
            id: parseInt(ad.changeEvent.changeResourceName.split('/').pop(), 10),  
            resourceName: ad.changeEvent.changeResourceName,  
            headlines: ad.changeEvent.newResource?.ad?.responsiveSearchAd?.headlines || [],  
            descriptions: ad.changeEvent.newResource?.ad?.responsiveSearchAd?.descriptions || [],  
            changeDateTime: ad.changeEvent.changeDateTime,  
            resourceChangeOperation: ad.changeEvent.resourceChangeOperation, 
            changedFields: ad.changeEvent.changedFields.split(','),  

            domain: domainName, 
            googleAdsId: googleAdsId
        }));
    });

    return ads;
}

 


export async function   processInBatches(tasks: (() => Promise<any>)[], batchSize: number) {
    logToCloudWatch('Entering processInBatches');
    try {
            const results: any[] = [];
    if(!tasks || tasks.length === 0) return [];
    for (let i = 0; i < tasks.length; i += batchSize) {
        const batch = tasks.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(task => task())); // Run batch in parallel
        results.push(...batchResults);
    }
    return results;
    } catch (error) {
        logToCloudWatch(`❌ Error in processInBatches: ${error?.message} `, 'ERROR');
        
    }
 
  }


  export async function fetchWebsitesInnerHtmlAndFindErrors(domains: Domain[], ignoreList: string[], gptService,     url?: string): Promise<any[]> {
    logToCloudWatch('Entering fetchWebsitesInnerHtml');

    let finalDomainData: websiteText[] = []; // Accumulate results for all domains

    if(url){
       domains = domains.slice(0,1);
       domains[0].paths = [url];
    }
 

    for (const domain of domains) {  
        let domainPagesInnerHtml: websiteText[] = []; // Store results per domain

        for (const path of domain.paths) {


            let  actualUrl = url ? url :  `https://${domain.hostname}${path}`;
            logToCloudWatch(`Fetching ${actualUrl}`, 'INFO', 'fetch Websites InnerHtml And Find Errors');
            try {
                const browser = await generateBrowser()
                const page = await browser.newPage();
                await page.goto(actualUrl, { waitUntil: 'networkidle2', timeout: 60000 });
                await new Promise(resolve => setTimeout(resolve, 1000));
                const content = await page.evaluate(() => document.body.innerText);
                const pageTitle = await page.title();
                await browser.close();
                domainPagesInnerHtml.push({ domain: domain.id, fullPath: actualUrl, innerHtml: content, titleElement: pageTitle });
            } catch (error) {
                logToCloudWatch(`Failed to fetch ${actualUrl}: ${error.message}`);
            }
        }
        // debug - domainPagesInnerHtml[0].innerHtml = 'Thehre are otgher metfhods to protect devieces '; domainPagesInnerHtml[0].titleElement = '2023'

        // Process inner HTML for each domain before moving to the next one. attach detected errors field to each object that represent path in this array
     
          domainPagesInnerHtml =   extractErrorsWithLocalLibrary(domainPagesInnerHtml, ignoreList);
        domainPagesInnerHtml = await extractErrorsWithGpt(gptService, domainPagesInnerHtml, ignoreList);
        domainPagesInnerHtml = domainPagesInnerHtml.map((w)=>({...w, detectedErrors: w.detectedErrors.length > 0 ? w.detectedErrors : []}));
        // Filter out pages with no detected errors
        domainPagesInnerHtml = domainPagesInnerHtml.filter(w => w.detectedErrors.length > 0 || w.outdatedYears.length > 0 );

        // Store only relevant results (excluding innerHtml)
        finalDomainData.push(...domainPagesInnerHtml);

        // Reset per-domain container for the next domain
        domainPagesInnerHtml = [];
    }

     
    return finalDomainData; // Return accumulated results for all domains
}



  export async function detectErrorsWithGpt(gptKey: string, websitesInnerHtml: any,gptService: GptService,  batchSize: number): Promise<string> {
    logToCloudWatch('Entering detectErrorsWithGpt');
    let gptErrorDetectionResults = '';
    
    const gptTasks = websitesInnerHtml.map(pageData => async () => {
        try {
            const gptResponse = await  gptService.askGpt2(gptKey, pageData);
            return {domain: pageData.domain,path: pageData.fullPath,errors: gptResponse.choices[0]?.message?.content || "No response" };
        } catch (error) {
            logToCloudWatch(`GPT request failed for ${pageData.fullPath}: ${error.message}`, 'ERROR');
            return { domain: pageData.domain, path: pageData.fullPath, errors: "GPT Error" };
        }
    });
  
    // Process GPT tasks in batches
    const gptResponses = await  processInBatches(gptTasks, batchSize);

    gptErrorDetectionResults = gptErrorDetectionResults.concat( gptResponses.map(res => JSON.stringify(res) ) .join('\n')  ); 
       
    return gptErrorDetectionResults;
  }

  export async function detectErrorsWithGpt2(gptKey: string, websitesInnerHtml: any,gptService: GptService,  batchSize: number): Promise<string> {
    const gptResponse = await  gptService.askGpt2(gptKey, websitesInnerHtml);
    return gptResponse.choices[0]?.message?.content || "No response";

  }



export   function filterOutIrrelevantErrors(gptErrorDetectionResults: gptProposal[]): gptProposal[] {
    if(!gptErrorDetectionResults || gptErrorDetectionResults?.length == 0 ) return [];
    gptErrorDetectionResults.forEach((result) => {result.jsonErrors = JSON5.parse(result.errors)}); // convert gpt errors per domain+path to AnyObject[]
    gptErrorDetectionResults= gptErrorDetectionResults.filter((result) => (result.jsonErrors.errors?.length > 0 && result.jsonErrors != '{}'));
    const cleanedResults = gptErrorDetectionResults.map((r) => ({
        jsonErrors: r.jsonErrors?.filter((je) => je?.errorWord !== je?.correction)  
    }))  
    

   logToCloudWatch(JSON.stringify(gptErrorDetectionResults), 'INFO', 'utils');
    return [];

}


export function extractMisspelledWords(text: string, excludedWords: string[]): string[] {
    const lowerExcludedWords = new Set(excludedWords.map(word => word.toLowerCase()));
    let innerHtmlSeparatedWords = text.replace(/[^a-zA-Z'-]+/g, ' ').toLowerCase().split(/\s+/).filter(Boolean);
    let misspelledWords = innerHtmlSeparatedWords.filter(word => spellchecker.isMisspelled(word));
    let finalMisspelledWordsDbfiltered = misspelledWords.filter(word => !lowerExcludedWords.has(word.toLowerCase()));
    return [...new Set(finalMisspelledWordsDbfiltered)]; // Remove duplicates
}

 

 
export function extractNonCapitalLetterWords(text: string, excludedWords: string[]): string[] {
    try {
            const extractedWords = text
        .replace(/[^a-zA-Z\s]/g, '') // Remove non-letter characters
        .split(/\s+/)
        .filter(word => Boolean(word))
        .filter(word => 
            word[0] !== word[0].toUpperCase() && // Check if first letter is capital
            (!excludedWords.includes(word.trim())  ) // Ensure the word is not in excludedWords
  );
  return extractedWords;
    } catch (error) {
        console.log(error)
    }

}


export function extractOutdatedYears(text: string): string[] {
  const currentYear = new Date().getFullYear();

  const validYears = [...text.matchAll(/\b20\d{2}\b/g)]
    .map(match => match[0])
    .filter(year => parseInt(year) !== currentYear);

  const malformedYears = [...text.matchAll(/\b20\d{3,}\b/g)]
    .map(match => match[0]);

  return [...new Set([...validYears, ...malformedYears])];
}
 
export function saveResults(results: any[]) {
    const filePath = path.join(__dirname, '../..', 'webSiteErrors.json');
    
    // Read existing file
    let existingData: any[] = [];
    if (fs.existsSync(filePath)) {
        existingData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    // Merge new results
    const newData = [...existingData, ...results];

    // Write back to file
    fs.writeFileSync(filePath, JSON.stringify(newData, null, 2), 'utf-8');
}

// Generic table formatter
interface TableColumn {
    name: string;
    width: number;
    getValue: (row: any) => string;
}

function formatTable(data: any[], columns: TableColumn[]): string {
    if (!data?.length) return '```\nNo data to display\n```';

    // Generate header
    const header = columns.map(col => col.name.padEnd(col.width)).join(' | ');
    const separator = columns.map(col => '-'.repeat(col.width)).join(' | ');

    // Generate rows
    const rows = data.map(row => 
        columns.map(col => col.getValue(row).padEnd(col.width)).join(' | ')
    );

    // Combine all parts
    return `\`\`\`\n${header}\n${separator}\n${rows.join('\n')}\n\`\`\``;
}

// Google Ads specific table columns
const googleAdsColumns: TableColumn[] = [
    { name: 'resource', width: 38, getValue: (row) => row.resource },
    { name: 'errors', width: 8, getValue: (row) => row.errors.join(',') },
    { name: 'domain', width: 30, getValue: (row) => row.domain },
    { name: 'googleAdsId', width: 12, getValue: (row) => row.googleAdsId.toString() },
    { name: 'wholeSentence', width: 50, getValue: (row) => row.wholeSentence },
    { name: 'location', width: 10, getValue: (row) => row.location }
];

// Website errors specific table columns
const websiteErrorsColumns: TableColumn[] = [
    { name: 'Domain', width: 8, getValue: (row) => row.domain.toString() },
    { name: 'Full Path', width: 48, getValue: (row) => row.fullPath },
    { name: 'Detected Errors', width: 20, getValue: (row) => row.detectedErrors.join(', ') },
    { name: 'Outdated Years', width: 4, getValue: (row) => (row.outdatedYears || []).join(', ') }
];

export function createErrorsTable(fileContent: string): string[] {
    const websiteErrors = JSON.parse(fileContent);
    const domainTables = new Map();

    websiteErrors.forEach((error) => {
        const domainId = error.domain;
        if (!domainTables.has(domainId)) {
            domainTables.set(domainId, []);
        }
        domainTables.get(domainId).push(error);
    });

    return [...domainTables.values()].map(errors => 
        formatTable(errors, websiteErrorsColumns)
    );
}

// Update the Google Ads error reporting to use the new table formatter
export function formatGoogleAdsErrors(errors: any[], type: 'spelling' | 'capitalization' | 'outdatedYears'): string {
    return formatTable(errors, googleAdsColumns);
}

// Database utility functions
export async function fetchIgnoreWords(kidonClient: any, configId: string): Promise<string[]> {
    const result = await kidonClient.raw('select * from configuration where id = ?', [configId]);
    if (!result?.[0]?.[0]?.values) {
        logToCloudWatch(`No ignore words found for config ID ${configId}`, 'WARN');
        return [];
    }
    
    return result[0][0].values
        .split(',')
        .map((word: string) => word.replace(/[\n"']/g, '').trim())
        .filter(Boolean);
}
 
export async function sendGoogleAdsErrorReports(errors: { spelling: any[], capitalization: any[], outdatedYears: any[] }, state: any) {
    await KF.sendSlackAlert('*🚨 Google Ads Content Errors:*', slackChannels.CONTENT, state.slackToken);
    
    if (errors.spelling.length > 0) {
        await KF.sendSlackAlert(formatGoogleAdsErrors(errors.spelling, 'spelling'), slackChannels.CONTENT, state.slackToken);
    } else {
        await KF.sendSlackAlert('🌿 No Spelling Errors Found', slackChannels.CONTENT, state.slackToken);
    }

    if (errors.capitalization.length > 0) {
        await KF.sendSlackAlert('*🚨Google Ads non-Capital words Errors:*', slackChannels.CONTENT, state.slackToken);
        await KF.sendSlackAlert(formatGoogleAdsErrors(errors.capitalization, 'capitalization'), slackChannels.CONTENT, state.slackToken);
    } else {
        await KF.sendSlackAlert('*🌿 No Capitalization Errors Found*', slackChannels.CONTENT, state.slackToken);
    }

    if (errors.outdatedYears.length > 0) {
        await KF.sendSlackAlert('*🚨Google Ads Outdated Years Errors:*', slackChannels.CONTENT, state.slackToken);
        await KF.sendSlackAlert(formatGoogleAdsErrors(errors.outdatedYears, 'outdatedYears'), slackChannels.CONTENT, state.slackToken);
    } else {
        await KF.sendSlackAlert('*🌿 No Outdated Years Errors Found*', slackChannels.CONTENT, state.slackToken);
    }
}


export   function checkIfLineupExists(html: string): boolean {
  const  lineupClassNames = [ 'main-partner-list_dosfjs_partnersArea_dosfjs', 'partnersArea_main-partner-list', 'ConditionalPartnersList', 'test-id-partners-list'  ];

  const $ = cheerio.load(html);

  // 🔍 Check via cheerio DOM
  const foundInDOM = $('*').toArray().some(el => {
    const classAttr = $(el).attr('class') || '';
    const idAttr = $(el).attr('id') || '';
    return lineupClassNames.some(name =>
      classAttr.includes(name) || idAttr.includes(name)
    );
  });
 
 
  // ✅ Return true if either found
  return foundInDOM  ;
 }









 export async function getActiveBingUrls(state) {
    const results = [];
    const bingDomains = state.domains.filter((d)=>d.bingAdsId)

    for (const domain of bingDomains) {
        // Find the company for this domain
        const company = state.companies.find(c => c.id === domain.companyId);
        if (!company) {
            console.warn(`No company found for domain ${domain.hostname}`);
            continue;
        }

        // Get the Bing access token for this company
        const accessToken = await KF.getBingAccessTokenFromRefreshToken(company);

        // Get Bing account/customer IDs from the domain or company object
        const customAccountId = domain.bingAdsId 
        const customerId = company.bingAccountId
        const developerToken = company.bingDeveloperToken

        // Skip if any required Bing info is missing
        if (!customAccountId || !customerId || !developerToken || !accessToken) {
            console.warn(`Missing Bing credentials for domain ${domain.hostname}`);
            continue;
        }

 
  
        // Build the SOAP request dynamically
        const soap = `
  <s:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header xmlns="https://bingads.microsoft.com/Reporting/v13">
    <AuthenticationToken>${accessToken}</AuthenticationToken>
    <CustomerAccountId>${customAccountId}</CustomerAccountId>
    <CustomerId>${customerId}</CustomerId>
    <DeveloperToken>${developerToken}</DeveloperToken>
  </s:Header>
  <s:Body>
    <SubmitGenerateReportRequest xmlns="https://bingads.microsoft.com/Reporting/v13">
      <ReportRequest xmlns:i="http://www.w3.org/2001/XMLSchema-instance" i:type="AdPerformanceReportRequest">
        <Format>Csv</Format>
        <ReportName>ActiveUrlsReport</ReportName>
        <ReturnOnlyCompleteData>true</ReturnOnlyCompleteData>
        <Aggregation>Daily</Aggregation>
        <Columns>
         <AdPerformanceReportColumn >TimePeriod</AdPerformanceReportColumn >
         <AdPerformanceReportColumn >CampaignName</AdPerformanceReportColumn >
         <AdPerformanceReportColumn >AdGroupName</AdPerformanceReportColumn >
          <AdPerformanceReportColumn >AdId</AdPerformanceReportColumn >
          <AdPerformanceReportColumn >FinalURL</AdPerformanceReportColumn >
        </Columns>
        <Scope>
          <AccountIds xmlns:a="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
            <a:long>${customAccountId}</a:long>
          </AccountIds>
          <Scope>Account</Scope>
        </Scope>
        <Time>
          <PredefinedTime>LastSevenDays</PredefinedTime>
        </Time>
      </ReportRequest>
    </SubmitGenerateReportRequest>
  </s:Body>
</s:Envelope>
        
        `;
        

        try {
     
  const response = await axios.post(
    'https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc',
    soap,
    {
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': 'GetCampaignsByAccountId',
      },
    }
  );
            const parser = new XMLParser();
            const json = parser.parse(response.data);
            const campaigns = json?.['s:Envelope']?.['s:Body']?.GetCampaignsByAccountIdResponse?.Campaigns?.Campaign || [];
            let wrongcredentials =json?.['s:Envelope']["s:Body"]["s:Fault"].detail.AdApiFaultDetail.Errors.AdApiError.Code
            if(wrongcredentials  ){
                logToCloudWatch(`AuthenticationTokenExpired for domain ${domain.hostname}`, 'ERROR');
             }
         } catch (error) {
            console.error(`Error fetching Bing Ads for domain ${domain.hostname}:`, error.message);
         }
    }

    return results;
}



 export async function getActiveGooglUrls(state: any){
    let domainsToProcess = state.domains.filter((d: Domain) => d.googleAdsId);
    const allTokens = await Promise.all(state.companies.map(async (c) => ({ company: c.name, token: await KF.getGoogleAuthToken(c) })));
    

   // ✅ Step 1: fetch lineups
   const rawLineupResults = await processInBatches(
       domainsToProcess.map((domain: Domain) => async () => {
           try {
               return await fetchGoogleSearchUrls(domain, state.companies, allTokens, googleAdsLandingPageQuery);
           } catch (error) {
               logToCloudWatch(`❌ Error fetching Google Ads for domain ${domain.id}: ${error.message}`, "ERROR");
               return { domain, results: [] };
           }
       }),
       30
   );
   let urlAndSlackChannel = extractGoogleSearchUrls(rawLineupResults);
   const baseUrlSet = new Set<string>();
   for (const obj of urlAndSlackChannel) {
      const match = obj.url.match(/^(https:\/\/[^\/]+\.com\/)/);
     if (match) {
       baseUrlSet.add(match[1]);
     }
   }
   return Array.from(baseUrlSet) ;
  }
 

export async function establishInvocaConnection(){
    const loginPage = await axios.get(`https://kolimnd.invoca.net/login`); //"https://<domain>/login"
    const tokenMatch = loginPage.data.match(/<input[^>]+name="authenticity_token"[^>]+value="([^"]+)"/)[1];
    const setCookieHeader = loginPage.headers['set-cookie'];
    const cookies = setCookieHeader.map((cookie) => cookie.split(';')[0]).join('; ');

    const myHeaders = new Headers();
    myHeaders.append('Authorization', `Bearer ${tokenMatch}`);
    myHeaders.append('Content-Type', 'application/x-www-form-urlencoded');
    myHeaders.append('Referer', `https://kolimnd.invoca.net/login`);
    myHeaders.append('Cookie', `${cookies}`);

    const urlencoded = new URLSearchParams();
    urlencoded.append('utf8', '✓');
    urlencoded.append('authenticity_token', `${tokenMatch}`);
    urlencoded.append('username', '^!&@(SPoToWER123@#');
    urlencoded.append('password', 'talso@spotower.com');
    urlencoded.append('commit', 'Log in');
    urlencoded.append('submit_type', '');

    const requestOptions: RequestInit = {
        method: 'POST',
        headers: myHeaders,
        body: urlencoded,
        redirect: 'follow' as RequestRedirect,
    };

    const res = await fetch(`https://kolimnd.invoca.net/login`, requestOptions);
}

  export async function fetchAllTransactions() {
    const limit = 4000; // Maximum rows per invoca API request
    let lastId = ''; // To track pagination (start_after_transaction_id)
    let totalResults = [];
    let hasMore = true;
    const endDate = new Date();
    const startDate = dayjs(endDate).subtract(1, 'day') 

    while (hasMore) {
        const url = `https://kolimnd.invoca.net/api/2022-09-29/affiliates/transactions/2054.json?from=${dayjs(startDate).format('YYYY-MM-DD')}&to=${dayjs(endDate).format('YYYY-MM-DD')}&oauth_token=3IqceMPe879Sk90AhFg9u7rNcqBjIan1tCzMIezOOBE&include_columns=${invocaColumns.join(',')}&limit=4000
        ${lastId ? `&start_after_transaction_id=${lastId}` : ''}`;
        const response = await axios.get(url);
        const transactions = response.data;
        totalResults = [...totalResults, ...transactions];
        if (transactions.length === limit) {
            lastId = transactions[transactions.length - 1].complete_call_id;
        } else {
            hasMore = false;
        }
    }
    return totalResults;
};

export function isLocal(){
    return process.env.ENVIRONMENT == 'local';
}

export async function generateBrowser() {
    const commonOptions = {
      headless: true,
      protocolTimeout: 60000,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--single-process'
      ]
    };
  
    return process.env.ENVIRONMENT === 'local'
      ? await puppeteer.launch(commonOptions)
      : await puppeteer.launch({
          ...commonOptions,
          executablePath: '/usr/bin/google-chrome-stable'
        });
  }
  
  // overall the function should be used to extract the base url from the url to further deduplicate the urls, but 
export const extractBaseUrl = (url: string) => {
 const paramsMatch = urlsWithParams.find(u=>url.includes(u))
if(paramsMatch){
    return url;
}else{
  const urlStructureMatch = url.match(/^(https?:\/\/[^?]+)/i);
  return urlStructureMatch ? urlStructureMatch[1] : null; 
}
 
   };
  


  export async function checkInvocaInDesktop(landingpage) {
    const browser = await generateBrowser();
    const page = await browser.newPage();

    try {
        await page.goto(landingpage, { waitUntil: 'networkidle2', timeout: 60000 });

        const invocaScripts = await page.evaluate(() =>
            Array.from(document.scripts)
                .filter(script => script.src.toLowerCase().includes('invoca'))
                .map(script => script.src)
        );

        if(invocaScripts.length == 0){
          console.log(`fail ${landingpage}`)
        }else{
          console.log(`success ${landingpage}`)
        }
        return invocaScripts;
    } catch (error) {
        logToCloudWatch(`❌ Error in checkInvocaInDesktop ${landingpage}: ${error.message}`, "ERROR", 'invoca lineup validation');
        
    } finally {
        await page.close();
        await browser.close(); // Always close browser
        
    }
}


export async function checkInvocaInMobile(landingpage) {
    const browser = await generateBrowser();
    const page = await browser.newPage();
    await page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 13_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.1 Mobile/15E148 Safari/604.1'
    );
    await page.setViewport({ width: 375, height: 812, isMobile: true });
    await page.goto(landingpage, { waitUntil: 'networkidle2', timeout: 60000 });
    try {
    const invocaScripts = await page.evaluate(() =>
        Array.from(document.scripts)
            .filter(script => script.src.toLowerCase().includes('invoca'))
            .map(script => script.src)
    );
     return invocaScripts;
} catch (error) {
    logToCloudWatch(`❌ Error in checkInvocaInMobile ${landingpage}: ${error.message}  `, "ERROR", 'invoca lineup validation');
 } finally {
    await page.close();
    await browser.close();
}
}


export const getTrafficIncongruence = (bqCampaignsTrafficMobile, bqCampaignsTrafficDesktop) => {
    const incongruentMobileDesctopTraffick = [];
    const incongruentDesctopMobileTraffick = [];
    const invalidCampaigns = [];
  
    bqCampaignsTrafficMobile.forEach((c) => {
      const isMatchDesktop = desktopOnlyTraffick.test(c.campaign_name);
      if (isMatchDesktop) {
        incongruentMobileDesctopTraffick.push(c);
      }
    });
  
    bqCampaignsTrafficDesktop.forEach((c) => {
      const isMatchMobile = mobileOnlyTraffick.test(c.campaign_name);
      if (isMatchMobile) {
        incongruentDesctopMobileTraffick.push(c);
      }
    });
  
    [...bqCampaignsTrafficMobile, ...bqCampaignsTrafficDesktop].forEach((c) => {
      const isValid = hasMobileOrDesktop.test(c.campaign_name);
      if (!isValid) {
        invalidCampaigns.push(c);
      }
    });
  
    return {
      incongruentMobileDesctopTraffick,
      incongruentDesctopMobileTraffick,
      invalidCampaigns
    };
  };


  export const assignDomainNames = (bqMobile: BqTrafficCampaign[], bqDesktop: BqTrafficCampaign[], mobileTraffic: SqlCampaignTraffic[], desktopTraffic: SqlCampaignTraffic[]) => {
    bqMobile.forEach(bqt => {
      const match = mobileTraffic.find(mt => Number(mt.campaign_id) === Number(bqt.campaign_id));
      bqt.domain_name = match ? match.domain_name : '';
    });
  
    bqDesktop.forEach(bqt => {
      const match = desktopTraffic.find(mt => Number(mt.campaign_id) === Number(bqt.campaign_id));
      bqt.domain_name = match ? match.domain_name : '';
    });
  };

  export const getUniqueCampaignErrors = (campaigns: BqTrafficCampaign[]) => {
    const seen = new Set();
    const unique = [];
  
    for (const c of campaigns) {
      const key = `${c.campaign_id}||${c.campaign_name}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(c);
      }
    }
  
    return unique;
  };



  export const sendTrafficValidationAlerts = async (
    mobile: BqTrafficCampaign[],
    desktop: BqTrafficCampaign[],
    invalid: BqTrafficCampaign[],
    isTest: boolean,
    state: any
  ) => {
    const channel = isTest ? slackChannels.PERSONAL : slackChannels.CONTENT;
  
    const buildMessage = (title: string, campaigns: BqTrafficCampaign[]) => {
      const body = campaigns.map(c =>
        `• *Campaign Name:* ${c.campaign_name}\n  *Campaign ID:* ${c.campaign_id}\n  *Domain:* ${c.domain_name}\n  *Device:* ${c.device}\n  *Date:* ${c.date?.value}\n  *Source:* ${c.media_source}\n  *Network:* ${c.network_type}`
      ).join('\n');
      return `*${title}*\n${body}`;
    };
  
    if (mobile.length || desktop.length || invalid.length) {
      if (mobile.length) {
        await KF.sendSlackAlert(
          buildMessage('🚨Incongruent Traffic (should be mobile only, but has desktop traffic):', mobile),
          channel,
          state.slackToken
        );
      }
  
      if (desktop.length) {
        await KF.sendSlackAlert(
          buildMessage('🚨Incongruent Traffic (should be desktop only, but has mobile traffic):', desktop),
          channel,
          state.slackToken
        );
      }
  
      if (invalid.length) {
        await KF.sendSlackAlert(
          buildMessage('🚨Invalid Traffic (should be mobile or desktop, but has none):', invalid),
          channel,
          state.slackToken
        );
      }
    } else {
      await KF.sendSlackAlert('🌿No incongruent traffic found', channel, state.slackToken);
    }
  };
  

// utils/invoca/detectInvocaPresence.ts

export async function isInvocaPresent(page: any): Promise<boolean> {
    return await page.evaluate(() => {
      // 1. Check script src
      const hasInvocaScriptSrc = Array.from(document.scripts).some(script =>
        script.src?.toLowerCase().includes('invoca')
      );
  
      // 2. Check inline script content
      const hasInvocaInlineScript = Array.from(document.scripts).some(script =>
        script.textContent?.toLowerCase().includes('invoca')
      );
  
      // 3. Check entire page HTML
      const hasInvocaInHTML = document.documentElement.innerHTML.toLowerCase().includes('invoca');
  
      // 4. Check global variables
      const hasInvocaGlobal = Object.keys(window).some(key =>
        key.toLowerCase().includes('invoca')
      );
  
      return hasInvocaScriptSrc || hasInvocaInlineScript || hasInvocaInHTML || hasInvocaGlobal;
    });
  }
  
 

export function categorizeErrors(errors: WebsiteError[]): CategorizedErrors {
  const categorized: CategorizedErrors = {
    contentErrors: {},
    outdatedYearsErrors: {},
    lineupErrors: {},
    timeoutErrors: {},
    httpErrors: {}
  };

  for (const error of errors) {
    const domain = error.url.match(/https?:\/\/([^\/]+)/)?.[1] || 'unknown';
    
    if (error.localErrors?.length > 0) {
      if (!categorized.contentErrors[domain]) categorized.contentErrors[domain] = [];
      categorized.contentErrors[domain].push(error);
    }
    
    if (error.outdatedYears?.length > 0) {
      if (!categorized.outdatedYearsErrors[domain]) categorized.outdatedYearsErrors[domain] = [];
      categorized.outdatedYearsErrors[domain].push(error);
    }
    
    if (error.reason === 'no lineup found') {
      if (!categorized.lineupErrors[domain]) categorized.lineupErrors[domain] = [];
      categorized.lineupErrors[domain].push(error);
    }
    
    if (error.reason === 'timeout') {
      if (!categorized.timeoutErrors[domain]) categorized.timeoutErrors[domain] = [];
      categorized.timeoutErrors[domain].push(error);
    }
    
    if (error.reason.includes('AxiosError')) {
      if (!categorized.httpErrors[domain]) categorized.httpErrors[domain] = [];
      categorized.httpErrors[domain].push(error);
    }
  }

  return categorized;
}

export { WebsiteError };
  
export async function sendCategorizedErrorsToSlack(
  categorizedErrors: CategorizedErrors, 
  isTest: boolean, 
  state: any
): Promise<void> {
  const messages: string[] = [];
// Content Errors
if (Object.keys(categorizedErrors.contentErrors).length > 0) {
  messages.push('*📝📝 ❗ CONTENT ERRORS ❗📝📝* \n');

  for (const [domain, domainErrors] of Object.entries(categorizedErrors.contentErrors)) {
    if (!domainErrors?.length) continue; // 🔒 skip if empty or invalid

    messages.push(`\n*Domain: ${domain}*`);
    messages.push('```');
    for (const error of domainErrors) {
      messages.push(`URL: ${error.url}, ERRORS: ${(error.localErrors || []).join(', ')}`);
    }
    messages.push('```'); // ✅ always close
  }
}
  // Outdated Years Errors
  if (Object.keys(categorizedErrors.outdatedYearsErrors).length > 0) {
    messages.push('\n*📅 Outdated Years:*');
  
    for (const [domain, domainErrors] of Object.entries(categorizedErrors.outdatedYearsErrors)) {
      if (!domainErrors?.length) continue;
  
      messages.push(`\n*Domain: ${domain}*`);
      messages.push('```');
      for (const error of domainErrors) {
        messages.push(`URL: ${error.url}, CAMPAIGN: ${error.campaignName}, YEARS: ${error.outdatedYears?.join(', ') || ''}`);
      }
      messages.push('```');
    }
  
    messages.push('\n\n\n');
  }

  // Lineup Errors
  if (Object.keys(categorizedErrors.lineupErrors).length > 0) {
    messages.push('\n*⚠️ Missing Lineup Content:*');
    for (const [domain, domainErrors] of Object.entries(categorizedErrors.lineupErrors)) {
      messages.push(`\n*Domain: ${domain}*`);
      for (const error of domainErrors) {
        messages.push(`• URL: ${error.url}`);
        messages.push(`  Campaign: ${error.campaignName}`);
      }
    }
  }

  // Timeout Errors
  if (Object.keys(categorizedErrors.timeoutErrors).length > 0) {
    messages.push('\n*⏰ Page Load Timeouts:*');
    for (const [domain, domainErrors] of Object.entries(categorizedErrors.timeoutErrors)) {
      messages.push(`\n*Domain: ${domain}*`);
      for (const error of domainErrors) {
        messages.push(`• URL: ${error.url}`);
        messages.push(`  Campaign: ${error.campaignName}`);
      }
    }
  }

  // HTTP Errors
  if (Object.keys(categorizedErrors.httpErrors).length > 0) {
    messages.push('\n*🔴 HTTP Errors:*');
    for (const [domain, domainErrors] of Object.entries(categorizedErrors.httpErrors)) {
      messages.push(`\n*Domain: ${domain}*`);
      for (const error of domainErrors) {
        messages.push(`• URL: ${error.url}`);
        messages.push(`  Campaign: ${error.campaignName}`);
        messages.push(`  Status: ${error.status}`);
      }
    }
  }

  if (messages.length > 0) {
    const finalMessage = messages.join('\n');
    logToCloudWatch(`Website Validation Errors:\n${finalMessage}`, 'ERROR');
    await KF.sendSlackAlert(finalMessage, isTest ? slackChannels.PERSONAL : slackChannels.CONTENT, state.slackToken);
  } else {
    logToCloudWatch(`:herb: No website errors found`);
    await KF.sendSlackAlert(`no website errors found`, isTest ? slackChannels.PERSONAL : slackChannels.CONTENT, state.slackToken);
  }
}
  