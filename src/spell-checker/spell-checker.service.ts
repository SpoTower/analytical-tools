import { Injectable,Logger } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
 import {fetchGoogleAds,filterOutTextlessAds,prepareAdsForGpt} from './utils';
 import { KnexService } from 'src/knex/knex.service';
import { GlobalStateService } from 'src/globalState/global-state.service';
 const logger = new Logger('analytical-tools.spellchecker');
 import { GptService } from 'src/gpt/gpt.service';
 import { logToCloudWatch } from 'src/logger'; 
import axios from 'axios';
 
 const { chromium } = require('playwright');
@Injectable()
export class SpellCheckerService {

  constructor(
    private readonly knexService: KnexService,
    private readonly globalState: GlobalStateService,
    private readonly gptService: GptService
    ) {}

  async findAndFixGoogleAdsGrammaticalErrors(domainId?: number) {

     const state = this.globalState.getAllState();
     for (const domain of state.domains) {
      logToCloudWatch((`processing domain ${domain.id}`))
      if (!domain.googleAdsId) continue;
      const adds = await fetchGoogleAds(domain, state.companies, state.allTokens );
      if ((adds && adds.length == 0) || !adds) continue;
      const textfullAds = filterOutTextlessAds(adds);
      if ((textfullAds && textfullAds.length == 0) || !textfullAds) continue;
      const preparedAds =  prepareAdsForGpt(adds)
      const response = await this.gptService.askGpt(state.gptKey, preparedAds);
      return response.choices[0].message.content || 'no errors found';
  }
 
 
  }
  async findAndFixWebsitesGrammaticalErrors(domainId?: number) {
    try {
        const state = this.globalState.getAllState();
        state.domains.forEach(domain => {
            domain.paths = state.paths
                .filter(p => p.domain_id === domain.id)
                .map(p => p.path);
        });

        const websitesInnerHtml: any[] = [];
        const gptErrorDetectionResults: any[] = [];

        const browser = await chromium.launch({ headless: false }); // Launch browser once

        // **1️⃣ Fetch Inner HTML from Websites with Batching**
        const batchSize = 10; // Control concurrency manually
        const domainTasks = state.domains
            .filter(domain => domain.id <= 3 && domain.hostname) // Filter valid domains
            .map(domain => async () => { // Wrap each task in an async function
                const page = await browser.newPage();
                for (const path of domain.paths.slice(0, 5)) {
                    const url = `https://${domain.hostname}${path}`;
                    
                    try {
                        console.log(`Visiting: ${url}`);
                        await page.goto(url, { waitUntil: 'load' });
                        const pageText = await page.evaluate(() => document.body.innerText);
                        websitesInnerHtml.push({ domain: domain.id, fullPath: url, innerHtml: pageText });
                    } catch (error) {
                        console.error(`Failed to load ${url}: ${error.message}`);
                    }
                }
                await page.close();
            });

        // Process website fetch tasks in batches
        await this.processInBatches(domainTasks, batchSize);

        await browser.close(); // Close browser after all tasks are done

        // **2️⃣ Send All Inner HTMLs to GPT in Parallel with Batching**
        const gptTasks = websitesInnerHtml.map(pageData => async () => {
            try {
                const gptResponse = await this.gptService.askGpt2(state.gptKey, pageData);
                return {
                    domain: pageData.domain,
                    path: pageData.fullPath,
                    errors: gptResponse.choices[0]?.message?.content || "No response"
                };
            } catch (error) {
                console.error(`GPT request failed for ${pageData.fullPath}: ${error.message}`);
                return { domain: pageData.domain, path: pageData.fullPath, errors: "GPT Error" };
            }
        });

        // Process GPT tasks in batches
        const gptResponses = await this.processInBatches(gptTasks, batchSize);
        gptErrorDetectionResults.push(...gptResponses);

        const gptKey = await axios.get(`http://localhost:3000/etl/sendEmail`,{headers: { Authorization: `Bearer ${process.env.KIDON_TOKEN}` }, params: { gptResponses} } )
        

        console.log(gptErrorDetectionResults);
    } catch (error) {
        logger.error(error);
    }
}
 
async   processInBatches(tasks: (() => Promise<any>)[], batchSize: number) {
  const results: any[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
      const batch = tasks.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch.map(task => task())); // Run batch in parallel
      results.push(...batchResults);
  }
  return results;
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


//      const pLimit = (await import('p-limit')).default;
