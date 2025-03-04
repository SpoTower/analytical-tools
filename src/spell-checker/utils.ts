import axios from 'axios';
import { AnyObject } from './consts';
import { logToCloudWatch } from 'src/logger';
const { chromium } = require('playwright');
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
import { webSitesIgnoreWords,   } from './ignoreWords';


export async function fetchGoogleAds(domain: Domain, companies: Company[], tokens:any ) {
    logToCloudWatch(`Entering fetchGoogleAds, fetching google ads for domain ${domain.id}`);
    const date = getDateRange(28, 'YYYY-MM-DD');
    try {
        const changeEventResult = await axios.post(
            `https://googleads.googleapis.com/v17/customers/${domain.googleAdsId}/googleAds:searchStream`,
            {
                query: `
                SELECT
                change_event.resource_name,   
                change_event.change_date_time,  
                change_event.change_resource_name,  
                change_event.resource_change_operation,   
                change_event.changed_fields,  
                change_event.old_resource,  
                change_event.new_resource  
            FROM change_event
            WHERE
                change_event.change_date_time BETWEEN  '${date.startDate}' AND '${date.endDate}'
            AND
                change_event.resource_change_operation IN (CREATE, UPDATE)
            AND
                 change_event.change_resource_type IN ('AD' )
             LIMIT 10000
                `,
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

  export async function fetchWebsitesInnerHtmlAndFindErrors(domains: Domain[], batchSize: number, ignoreList:string[]): Promise<any[]> {
    logToCloudWatch('Entering fetchWebsitesInnerHtml');
    let domainPagesInnerHtml: websiteText[] = [];
    
    const browser = await chromium.launch({ headless: false }); // Launch browser once

    for (const domain of domains) {  
        const pathBatches: string[][] = [];
 
        // Create batches of paths, each batch with at most 'batchSize' paths
        for (let i = 0; i < domain.paths.length; i += batchSize) { 
            pathBatches.push(domain.paths.slice(i, i + batchSize));
        }  
         for (const batch of pathBatches) {
            await Promise.all(batch.map(async (path) => {
                const page = await browser.newPage(); // ✅ Open a new page per request
                const url = `https://${domain.hostname}${path}`;
                try {
                    logToCloudWatch(`Visiting: ${url}`, 'INFO', 'utils');
                    await page.goto(url, { waitUntil: 'load' });

                    // ✅ Retry logic: Check if the page is a security verification page
                    let pageText = await page.evaluate(() => document.body.innerText);
                    let retries = 5; // Max retries
                    while (retries > 0 && pageText.includes("Vercel Security Checkpoint")) {
                        logToCloudWatch(`Security checkpoint detected, retrying... (${5 - retries}/5)`, 'INFO', 'utils');
                        await page.waitForTimeout(2000); // Wait for 2 seconds
                        pageText = await page.evaluate(() => document.body.innerText);
                        retries--;
                    }

                    domainPagesInnerHtml.push({ domain: domain.id, fullPath: url, innerHtml: pageText });
                } catch (error) {
                    logToCloudWatch(`Failed to load ${url}: ${error.message}`, 'ERROR', 'utils');
                } finally {
                    await page.close(); // ✅ Close the page after processing
                }
            }));
        }
        domainPagesInnerHtml.forEach(webSiteText => { webSiteText.detectedErrors = extractMisspelledWords(webSiteText.innerHtml, ignoreList); }); // assign array of errors to each website     
        domainPagesInnerHtml = domainPagesInnerHtml.filter((w) => w.detectedErrors.length > 0); // Remove websites with no errors

  
      saveResults(domainPagesInnerHtml.map(({ innerHtml, ...rest }) => rest)); // errors per path
      domainPagesInnerHtml = []; // Clear array for next domain
    }

    await browser.close(); // Close browser after all tasks are done
    return domainPagesInnerHtml;
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
    const lowerExcludedWords = excludedWords.map(word => word.toLowerCase()); // Convert excluded words to lowercase

    return [...new Set(
        text
            .split(" ")
            .filter(word => /^[A-Za-z]+$/.test(word)) // Keep only words with letters
            .filter(word => !lowerExcludedWords.some(excluded => word.toLowerCase().includes(excluded))) // Case-insensitive comparison
            .filter(word => spellchecker.isMisspelled(word)) // Check for misspelled words
    )];
}

 
export function saveResults(results: any[]) {
    const filePath = path.join(__dirname, '../..', 'savedData.json');
    
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

export function fetchOnlyLiveDomains(domains: Domain[]) {

}