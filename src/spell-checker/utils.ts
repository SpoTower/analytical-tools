import axios from 'axios';
import { AnyObject } from './consts';
import { logToCloudWatch } from 'src/logger';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { GptService } from 'src/gpt/gpt.service';
 import {websiteText} from './interfaces';
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
import {slackChannels}  from './consts';
import { log } from 'console';
import { XMLParser } from 'fast-xml-parser';
import { googleAdsLandingPageQuery } from './gaqlQuerys';

export async function fetchGoogleAds(domain: Domain, companies: Company[], tokens:any, query:string ) {
    logToCloudWatch(`Entering fetchGoogleAds, fetching google ads for domain ${domain.id}`);
    console.log(companies.find((c)=>c.id == domain.companyId ).name);
    const date = getDateRange(1, 'YYYY-MM-DD');
    if(query.includes('<startDate>') && query.includes('<endDate>')) {
        query = query.replace('<startDate>', date.startDate).replace('<endDate>', date.endDate);
    }

    try {
        const changeEventResult = await axios.post(
            `https://googleads.googleapis.com/v17/customers/${domain.googleAdsId}/googleAds:searchStream`,
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




    export async function fetchLineups(domain: Domain, companies: Company[], tokens:any, query:string): Promise<any> {
        const landingPageResult = await axios.post(
            `https://googleads.googleapis.com/v17/customers/${domain.googleAdsId}/googleAds:searchStream`,
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

    export function processLineupResults(rawResults: {domain: Domain, results: any[]}[]): {url: string, slackChannelId: string, campaignName: string}[] {
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


  export async function fetchWebsitesInnerHtmlAndFindErrors(domains: Domain[], ignoreList: string[], state: any): Promise<any[]> {
    logToCloudWatch('Entering fetchWebsitesInnerHtml');

    let finalDomainData: websiteText[] = []; // Accumulate results for all domains

    for (const domain of domains) {  
        let domainPagesInnerHtml: websiteText[] = []; // Store results per domain

        for (const path of domain.paths ) {
            const url = `https://${domain.hostname}${path}`;
            try {

                // getting the text of the page
                const { data: html } = await axios.get(url);
                const dom = new JSDOM(html, { url });
                const article = new Readability(dom.window.document).parse();

                // getting the relevant html text
                const $ = cheerio.load(html);
                const titles = $('title').map((_, el) => $(el).text()).get();


                domainPagesInnerHtml.push({ domain: domain.id, fullPath: url, innerHtml: article.textContent, titleElement: titles.join(' ') });
            } catch (error) {
                logToCloudWatch(`Failed to fetch ${url}: ${error.message}`);
            }
        }
        // debug - domainPagesInnerHtml[0].innerHtml = 'Thehre are otgher metfhods to protect devieces '; domainPagesInnerHtml[0].titleElement = '2023'

        // Process inner HTML for each domain before moving to the next one. attach detected errors field to each object that represent path in this array
        domainPagesInnerHtml.forEach(webSiteText => {
            webSiteText.detectedErrors = extractMisspelledWords(webSiteText.innerHtml, ignoreList);
            // Check for outdated years in both title and fullPath
            const titleYears = extractOutdatedYears(webSiteText.titleElement || '');
            const pathYears = extractOutdatedYears(webSiteText.fullPath);
            webSiteText.outdatedYears = [...new Set([...titleYears, ...pathYears])]; // Combine and remove duplicates
        });

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
 
    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Function to split words with multiple capital letters (e.g., "TotalAV" → ["Total", "AV"])
    const splitByCapitalLetters = (word: string): string[] => {
        return word.split(/(?=[A-Z][a-z])/); // Split before capital letters followed by lowercase
    };

    // Process each word: split by spaces, then split merged words
    let innerHtmlSeparatedWords = text
        .split(/\s+/) // Split by spaces
        .flatMap(splitByCapitalLetters) // Further split words with multiple capital letters
        .filter(word => /^[A-Za-z]+$/.test(word)); // Keep only valid words

    // Filter out ignored words




    // apply spechecer to inner html words
    let misspelledWords = innerHtmlSeparatedWords.filter(word => spellchecker.isMisspelled(word));
 
//apply ignore list to alleged errors after spellchecker

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
    return [...text.matchAll(/\b(19|20)\d{2}\b/g)]
        .map(match => match[0])
        .filter(year => parseInt(year) !== currentYear);
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
    const  lineupClassNames = ['PartnerLists_container__hmkhb PartnerLists_open__WAh6E PartnerList_list__5eMzn',
        'partnersArea_main-partner-list', 'ConditionalPartnersList', 'test-id-partners-list',
        'homePage_partners-list-section', 'articlesSection_container', 'partnerNode', 'Partner', 'partner' ];
  // const  lineupClassNames = [ 'partnersArea_main-partner-list', 'ConditionalPartnersList', 'test-id-partners-list'  ];

  const $ = cheerio.load(html);

  // 🔍 Check via cheerio DOM
  const foundInDOM = $('*').toArray().some(el => {
    const classAttr = $(el).attr('class') || '';
    const idAttr = $(el).attr('id') || '';
    return lineupClassNames.some(name =>
      classAttr.includes(name) || idAttr.includes(name)
    );
  });

  // 🧪 Fallback check via raw HTML
  const foundInRawHtml = lineupClassNames.some(name => html.includes(name));
 
  // ✅ Return true if either found
  return foundInDOM || foundInRawHtml;
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
          <string>TimePeriod</string>
          <string>CampaignName</string>
          <string>AdGroupName</string>
          <string>AdId</string>
          <string>FinalURL</string>
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
      `
        
          const response = await axios.post(
            'https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/v13/ReportingService.svc',
            soap,
            {
              headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': 'SubmitGenerateReport',
              },
              timeout: 60000,
            }
          );
        
          const parser = new XMLParser();
          const json = parser.parse(response.data);
          results.push(json?.['s:Envelope']?.['s:Body']?.SubmitGenerateReportResponse?.ReportRequestId) 
        

    
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
               return await fetchLineups(domain, state.companies, allTokens, googleAdsLandingPageQuery);
           } catch (error) {
               logToCloudWatch(`❌ Error fetching Google Ads for domain ${domain.id}: ${error.message}`, "ERROR");
               return { domain, results: [] };
           }
       }),
       30
   );
   let urlAndSlackChannel = processLineupResults(rawLineupResults);
   const baseUrlSet = new Set<string>();
   for (const obj of urlAndSlackChannel) {
      const match = obj.url.match(/^(https:\/\/[^\/]+\.com\/)/);
     if (match) {
       baseUrlSet.add(match[1]);
     }
   }
   return Array.from(baseUrlSet) ;
  }
 



  export async function getBingCampaigns({ accessToken, customAccountId, customerId, developerToken }) {
    const soap = `
  <s:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
    <s:Header xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
      <AuthenticationToken>${accessToken}</AuthenticationToken>
      <CustomerAccountId>${customAccountId}</CustomerAccountId>
      <CustomerId>${customerId}</CustomerId>
      <DeveloperToken>${developerToken}</DeveloperToken>
    </s:Header>
    <s:Body>
      <GetCampaignsByAccountIdRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
        <AccountId>${customAccountId}</AccountId>
        <CampaignType>Search</CampaignType>
      </GetCampaignsByAccountIdRequest>
    </s:Body>
  </s:Envelope>`;
  
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
  
    return Array.isArray(campaigns) ? campaigns : [campaigns];
  }
  export async function getBingAdGroups({ campaignId, accessToken, customAccountId, customerId, developerToken }) {
    const soap = `
  <s:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
    <s:Header xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
      <AuthenticationToken>${accessToken}</AuthenticationToken>
      <CustomerAccountId>${customAccountId}</CustomerAccountId>
      <CustomerId>${customerId}</CustomerId>
      <DeveloperToken>${developerToken}</DeveloperToken>
    </s:Header>
    <s:Body>
      <GetAdGroupsByCampaignIdRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
        <CampaignId>${campaignId}</CampaignId>
      </GetAdGroupsByCampaignIdRequest>
    </s:Body>
  </s:Envelope>`;
  
    const response = await axios.post(
      'https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc',
      soap,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'GetAdGroupsByCampaignId',
        },
      }
    );
  
    const parser = new XMLParser();
    const json = parser.parse(response.data);
    const adGroups = json?.['s:Envelope']?.['s:Body']?.GetAdGroupsByCampaignIdResponse?.AdGroups?.AdGroup || [];
  
    return Array.isArray(adGroups) ? adGroups : [adGroups];
  }
  export async function getBingAds({ adGroupId, accessToken, customAccountId, customerId, developerToken }) {
    const soap = `
  <s:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
    <s:Header xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
      <AuthenticationToken>${accessToken}</AuthenticationToken>
      <CustomerAccountId>${customAccountId}</CustomerAccountId>
      <CustomerId>${customerId}</CustomerId>
      <DeveloperToken>${developerToken}</DeveloperToken>
    </s:Header>
    <s:Body>
      <GetAdsByAdGroupIdRequest xmlns="https://bingads.microsoft.com/CampaignManagement/v13">
        <AdGroupId>${adGroupId}</AdGroupId>
      </GetAdsByAdGroupIdRequest>
    </s:Body>
  </s:Envelope>`;
  
    const response = await axios.post(
      'https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc',
      soap,
      {
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': 'GetAdsByAdGroupId',
        },
      }
    );
  
    const parser = new XMLParser();
    const json = parser.parse(response.data);
    const ads = json?.['s:Envelope']?.['s:Body']?.GetAdsByAdGroupIdResponse?.Ads?.Ad || [];
  
    const adsArray = Array.isArray(ads) ? ads : [ads];
    const finalUrls = [];
  
    for (const ad of adsArray) {
      const url = ad?.FinalUrls?.['a:string'];
      if (url) {
        finalUrls.push(typeof url === 'string' ? url : url[0]);
      }
    }
  
    return finalUrls;
  }
  