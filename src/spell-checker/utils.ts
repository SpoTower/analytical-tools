import axios from 'axios';
import { AnyObject } from './consts';
import { logToCloudWatch } from 'src/logger';
const { chromium } = require('playwright');
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { GptService } from 'src/gpt/gpt.service';
import {State} from 'src/globalState/interfaces';
import {websiteText} from './interfaces';
import { Domain } from 'src/kidonInterfaces/shared';
import { Company } from 'src/kidonInterfaces/shared';
import { gptProposal } from './interfaces';
 import JSON5 from 'json5';
import { getDateRange } from 'src/utils';

 

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
                    Authorization: `Bearer ${tokens.data.find((t) => t.company ==  companies.find((c)=>c.id == domain.companyId ).name ).token}`,
                    'login-customer-id': companies.find((c)=>c.id == domain.companyId ).googleCustomerId,
                },
            }
        );
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


export function prepareAdsForGpt(textfullAds: Record<string, any>[]) {
    logToCloudWatch(`Entering prepareAdsForGpt, found ${textfullAds?.length} ads`);

    return textfullAds.flatMap((t) => 
    t.ads.map((ad : Record<string, any>) => ({
        id: parseInt(ad.changeEvent.changeResourceName.split('/').pop(), 10), // Extract Ad ID
        resourceName: ad.changeEvent.changeResourceName, // Use correct resource name
        headlines: ad.changeEvent.newResource?.ad?.responsiveSearchAd?.headlines || [], // New headlines
        descriptions: ad.changeEvent.newResource?.ad?.responsiveSearchAd?.descriptions || [], // New descriptions
        changeDateTime: ad.changeEvent.changeDateTime, // Change timestamp
        resourceChangeOperation: ad.changeEvent.resourceChangeOperation, // Type of change (CREATE, UPDATE, REMOVE)
        changedFields: ad.changeEvent.changedFields.split(','), // List of changed fields
    }))
);
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
  export async function fetchWebsitesInnerHtml(domains: Domain[], batchSize: number): Promise<any[]> {
    logToCloudWatch('Entering fetchWebsitesInnerHtml');
    const websitesInnerHtml: websiteText[] = [];
    const browser = await chromium.launch({ headless: false }); // Launch browser once
  
    const domainTasks =  domains.map(domain => async () => {  
            const page = await browser.newPage();
            for (const path of domain.paths.slice(0, 3)) {
                const url = `https://${domain.hostname}${path}`;
  
                try {
                    logToCloudWatch(`Visiting: ${url}`, 'INFO', 'utils');
                    await page.goto(url, { waitUntil: 'load' });
                    const pageText = await page.evaluate(() => document.body.innerText);
                    websitesInnerHtml.push({ domain: domain.id, fullPath: url, innerHtml: pageText });
                } catch (error) {
                    logToCloudWatch(`Failed to load ${url}: ${error.message}`, 'ERROR', 'utils');
                }
            }
            await page.close();
        });
         
        
  
    // Process website fetch tasks in batches
    await  processInBatches(domainTasks, batchSize);
    await browser.close(); // Close browser after all tasks are done
  
    return websitesInnerHtml;
  }
  
 

  export async function detectErrorsWithGpt(gptKey: string, websitesInnerHtml: any[],gptService: GptService,  batchSize: number): Promise<string> {
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
 
 