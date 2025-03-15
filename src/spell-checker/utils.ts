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


  export async function fetchWebsitesInnerHtmlAndFindErrors(domains: Domain[], ignoreList: string[], state:any): Promise<any[]> {
    logToCloudWatch('Entering fetchWebsitesInnerHtml');
    let domainPagesInnerHtml: websiteText[] = [];
  
    for (const domain of domains) {  
         
            for (const path of domain.paths.slice(0,1)) {
            //  const url = `https://${domain.hostname}${path}`;
            const url = 'https://top10antivirusexperts.com/mac-cleaner-m/'
                const { data: html } = await axios.get(url);
                const dom = new JSDOM(html, { url });
                const article = new Readability(dom.window.document).parse();
                domainPagesInnerHtml.push({ domain: domain.id, fullPath: url, innerHtml: article.textContent });
            }
        

      // Process all domain (single domain) paths inner html **per domain** before moving to the next
      domainPagesInnerHtml.forEach(webSiteText => {   webSiteText.detectedErrors = extractMisspelledWords(webSiteText.innerHtml, ignoreList);  });
      const lowerExcludedWords = new Set(ignoreList.map(word => word.toLowerCase()));

    //  await KF.sendSlackAlert('detected errors ',slackChannels.PERSONAL, state.slackToken);
    //  await KF.sendSlackAlert(`${ domainPagesInnerHtml[0].detectedErrors}`,slackChannels.PERSONAL, state.slackToken);

     //  await KF.sendSlackAlert('Inner html ',slackChannels.PERSONAL, state.slackToken);
     // await KF.sendSlackAlert(`${ domainPagesInnerHtml[0].innerHtml}`,slackChannels.PERSONAL, state.slackToken);

     // await KF.sendSlackAlert('Ignore list ',slackChannels.PERSONAL, state.slackToken);
    //  await KF.sendSlackAlert(`${ ignoreList}`,slackChannels.PERSONAL, state.slackToken);

      await KF.sendSlackAlert('lowerExcludedWords',slackChannels.PERSONAL, state.slackToken);
      await KF.sendSlackAlert(`${ Array.from(lowerExcludedWords).join(", ") }`, slackChannels.PERSONAL, state.slackToken);
      


      domainPagesInnerHtml = domainPagesInnerHtml.filter((w) => w.detectedErrors.length > 0);

     let finalDomainData = domainPagesInnerHtml.map(({ innerHtml, ...rest }) => rest);
  
      // Clear results for next domain
      domainPagesInnerHtml = [];
    }
  
    return []; // No need to return accumulated results since they're saved per domain
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
    logToCloudWatch("lowerExcludedWords:" +   Array.from(lowerExcludedWords));

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Function to split words with multiple capital letters (e.g., "TotalAV" → ["Total", "AV"])
    const splitByCapitalLetters = (word: string): string[] => {
        return word.split(/(?=[A-Z][a-z])/); // Split before capital letters followed by lowercase
    };

    // Process each word: split by spaces, then split merged words
    let words = text
        .split(/\s+/) // Split by spaces
        .flatMap(splitByCapitalLetters) // Further split words with multiple capital letters
        .filter(word => /^[A-Za-z]+$/.test(word)); // Keep only valid words

 
    // Filter out ignored words
    words = words.filter(word => {
        const lowerWord = word.toLowerCase();
        const isExcluded = lowerExcludedWords.has(lowerWord);
        
        return !isExcluded;
    });

    logToCloudWatch("Allegedly erroneous words after DB-based filtering: " + JSON.stringify([...words]));

  // Define additional words to exclude from final errors
  const additionalExcludedWords = new Set([
    "apps", "uninstalled", "app", "antivirus", "ransomware", 
    "malware", "cryptocurrency", "bitcoin", "avira"
]);

// Check for misspellings and exclude additional words
const misspelledWords = words.filter(word => {
    const isMisspelled = spellchecker.isMisspelled(word);
    const shouldExclude = additionalExcludedWords.has(word.toLowerCase());

 
    return isMisspelled && !shouldExclude;
});


    logToCloudWatch(`Final misspelled words: ${misspelledWords.join(", ")}`);

    return [...new Set(misspelledWords)]; // Remove duplicates
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

 export function createErrorsTable(fileContent): string {
    let slackWebsiteMessage = "```\n"; // Start code block
    slackWebsiteMessage += "Domain  | Full Path                                       | Detected Errors \n";
    slackWebsiteMessage += "--------|------------------------------------------------|----------------\n";
    
  // ✅ Add each row formatted properly
  const websiteErrors = JSON.parse(fileContent); // Read saved JSON file

  websiteErrors.forEach((error) => {
    let errorList = error.detectedErrors.join(", ");

    // If error list is too long, break it into multiple lines
    if (errorList.length > 50) {
        const words = errorList.split(", ");
        errorList = "";
        let line = "";

        for (let word of words) {
            if ((line + word).length > 50) {
                errorList += line + "\n\t\t\t\t\t\t\t\t\t  "; // Add a tabbed indent for continuation
                line = word + ", ";
            } else {
                line += word + ", ";
            }
        }
        errorList += line.trimEnd(); // Add the last line
    }

    slackWebsiteMessage += `${error.domain.toString().padEnd(8)} | ${error.fullPath.padEnd(48)} | ${errorList}\n`;
});    
    slackWebsiteMessage += "```"; // ✅ Close the monospace block

    return slackWebsiteMessage;
 }