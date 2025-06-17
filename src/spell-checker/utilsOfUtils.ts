import { extractMisspelledWords, extractOutdatedYears } from "./utils";
import { pageContentMetaData } from './interfaces';
import { GptService } from 'src/gpt/gpt.service';
import { locatingWebSitesErrors } from './consts';

export function extractErrorsWithLocalLibrary(domainPagesInnerHtml: pageContentMetaData[], ignoreList:string[], state: any) {
    domainPagesInnerHtml.forEach(webSiteText => {
        webSiteText.detectedErrors = extractMisspelledWords(webSiteText.innerHtml, ignoreList, state);

        // Check for outdated years in both title and fullPath
        const titleYears = extractOutdatedYears(webSiteText.titleElement || '');
        const pathYears = extractOutdatedYears(webSiteText.fullPath);
        webSiteText.outdatedYears = [...new Set([...titleYears, ...pathYears])]; // Combine and remove duplicates
    });
    return domainPagesInnerHtml;
}

export async function extractErrorsWithGpt(gptService: GptService, domainPagesInnerHtml: pageContentMetaData[], ignoreList: string[]): Promise<pageContentMetaData[]> {
    const gptPrompt = locatingWebSitesErrors();// gpt prompt for grammatical errors detection
    
    for (const page of domainPagesInnerHtml) {
      
            const gptResponse = await gptService.askGpt01(process.env.GPT_KEY,gptPrompt, JSON.stringify(page.detectedErrors));

            const content = gptResponse.choices[0]?.message?.content;
            const parsed = JSON.parse(content  );
            page.detectedErrors = Array.isArray(parsed) ? parsed : [];
            
        
    }

    return domainPagesInnerHtml;
}