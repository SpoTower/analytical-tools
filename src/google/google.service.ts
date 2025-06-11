import { Injectable, Inject, Logger } from '@nestjs/common';
import { CreateGoogleDto } from './dto/create-google.dto';
import { UpdateGoogleDto } from './dto/update-google.dto';
import {conversionActions} from './interfaces'
import {createObcConfigParams} from './consts'
import axios from 'axios'
import { GlobalStateService } from 'src/globalState/global-state.service';
 import * as KF from '@spotower/my-utils';
 import { Knex } from 'knex';
 import {   KIDON_CONNECTION } from 'src/knex/knex.module';
 const logger = new Logger('google-service');
import {googleAdsSourceData,CampaignWordsChunk,ConstantHeadersAndDescriptions} from './interfaces'
import { GptService } from 'src/gpt/gpt.service';
import {campaignLevelSystemMessage,campaignLevelPrompt,exampleResponseCampaigns,addGroupLevelSystemMessage,addGroupLevelPrompt,addLevelSystemMessage,addLevelPrompt} from './prompts'
import {generateRowsUsinObjectTemplate,extractHeadlinesAndDescriptions,exportToCsv,generateFullAddObject,extractCampaignChunks,parseAdGroupBlocks,generateDualCampaignRows, generateFullAddObject2} from './utils/generateAds'
import { keywordTemplateDefaults,adsTemplateDefaults,adGroupTemplateDefaults,campaignTemplateDefaults } from './adsConsts';
import { logToCloudWatch }  from 'src/logger';
import {addLevelPrompt as addLevelPromptBoxA} from './prompts'
import {harvestSpecificContentFromFirstAd,generateConstantHeadersAndDescriptions} from './utils/generateAds'
@Injectable()
export class GoogleService {

  constructor(
     private readonly globalState: GlobalStateService,
     @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,
     private readonly gptService: GptService,
     ) {}

     //create conversion action on hostname
  async createConversionActions(conversionActions: conversionActions[], hostname:string) {
    logToCloudWatch('entering createConversionActions');
       const companies  = await this.kidonClient('companies') 
       const domains = await this.kidonClient('domain') 
       let allTokens
       
      try {
            allTokens = await Promise.all( companies.map(async (c) => ({ company: c.name,token: await KF.getGoogleAuthToken(c)})));
      } catch (error) { 
        logger.log(error);
      }
     
   const company =  companies.find((c)=>c.id ==  domains.find((d)=>d.hostname == hostname).companyId)
   const domainGoogleAdsId =  domains.find((d)=>d.hostname == hostname).googleAdsId
   const token = allTokens.find((t) => t.company === company.name)?.token
   const results = [];

   for (const action of conversionActions ) {
    const operations = createObcConfigParams([{ name: action['Conversions Name Action'], category: action['Conversion Category'], attributionModel: action['Attribution'],countingType: action['Type']  },]); //Attribution
      
    logToCloudWatch(`uploading to google: ${operations.map((op)=>JSON.stringify(op))}, length: ${operations.length}`,  'INFO', 'UPLOAD_CONVERSIONS');

  
    try {
      const result = await axios.post(`https://googleads.googleapis.com/v19/customers/${domainGoogleAdsId}/conversionActions:mutate`,
        { operations },
        { headers: { 'developer-token': company.googleDeveloperToken, Authorization: `Bearer ${token}`,'login-customer-id': company.googleCustomerId,},}
      );
 
      logToCloudWatch(`number of uploaded conversion actions :, ${result?.data?.results?.length}`,  'INFO', 'UPLOAD_CONVERSIONS');
      results.push(result.data);
    } catch (error) {
      logToCloudWatch(error.response?.data?.error?.message ||   error.response?.data?.error?.details?.[0]?.errors?.[0]?.message || error.response?.data?.error?.message)
      if (error.response?.data) {
         throw new Error(JSON.stringify(error?.response?.data))
        }
        logToCloudWatch(JSON.stringify(error), 'ERROR', 'UPLOAD_CONVERSIONS');
    }
  }
  return results;

}  

async updateConversionNamesKidonTable(conversionActions?:any[],creationResult?:any, domainId?:number){
  logger.log('entering updateConversionNamesKidonTable');

  try {
    if (Array.isArray(creationResult) && conversionActions?.length === creationResult.length) {
      const dataToInsert = conversionActions.map((c, index) => ({
        resource_name: creationResult[index].results[0].resourceName,
        name: c['Conversions Name Action'],
        goal: 'secondary',
        domain_id: domainId,
        created_at: new Date(),
      }));
    
     let res =  await this.kidonClient('conversion_name').insert(dataToInsert);
    return res;
    } else {
      throw new Error('Error updating conversion names in kidon table: mismatch between conversion actions and creation results');
    }
  } catch (error) {
    logger.error(`Error updating conversion names in kidon table: ${error.message}`);
    throw new Error(`Error updating conversion names in kidon table: ${error.message}`);
  }
}
    




 
async generateAds(sourceData:googleAdsSourceData){
  logToCloudWatch('Entering generateAds endpoint. ', 'INFO', 'google');
      const fullPrompt = `${addLevelPromptBoxA}. the word that should be used for this task is ${JSON.stringify(sourceData.industryKeyword[0])}`;
      const gptResponse = await this.gptService.askGpt01(process.env.GPT_KEY, addLevelSystemMessage, fullPrompt);
      let constantheadersAndDescriptions = generateConstantHeadersAndDescriptions(gptResponse.choices[0].message.content, adsTemplateDefaults, sourceData.hostname);
     
  
      try {
  
      
            const [boxA, boxB, boxC] = await Promise.all([
        this.processBoxA(sourceData, constantheadersAndDescriptions),
        this.processBoxB(sourceData, constantheadersAndDescriptions),
        this.processBoxC(sourceData, constantheadersAndDescriptions)
      ]); 
  
   
      const campaigns1 = [   ...boxA.campaigns, ...boxB.campaigns, ...boxC.campaigns];
      const adGroups1 = [  ...boxA.adGroups, ...boxB.adGroups, ...boxC.adGroups];
      const keywords1 = [  ...boxA.keywords, ...boxB.keywords, ...boxC.keywords];
      const ads1 = [   ...boxA.ads, ...boxB.ads, ...boxC.ads];
    
    
   
     const campaignsCsv =  await exportToCsv(campaigns1, 'campaigns.csv');
      const adGroupsCsv = await exportToCsv(adGroups1, 'ad-groups.csv');
      const keywordsCsv = await exportToCsv(keywords1, 'keywords.csv');
      const adsCsv = await exportToCsv(ads1, 'ads.csv');
  logToCloudWatch('finishing generateAds', 'INFO', 'GENERATE_ADS');
      return {
        campaignsCsv,
        adGroupsCsv,
        keywordsCsv,
        adsCsv
      }
      } catch (error) {
        logToCloudWatch(error.message, 'ERROR', 'GENERATE_ADS');
      }
     }
  

  create(createGoogleDto: CreateGoogleDto) {
    return 'This action adds a new google';
  }

  findAll() {
    return `This action returns all google`;
  }

  findOne(id: number) {
    return `This action returns a #${id} google`;
  }

  update(id: number, updateGoogleDto: UpdateGoogleDto) {
    return `This action updates a #${id} google`;
  }

  remove(id: number) {
    return `This action removes a #${id} google`;
  }

  async processBoxA(sourceData: googleAdsSourceData, constantheadersAndDescriptions: ConstantHeadersAndDescriptions) {
    const campaigns = [];
    const adGroups = [];
    const ads = [];
    const keywords = [];
  
    const [c1, c2] = generateDualCampaignRows(sourceData.industryKeyword[0], campaignTemplateDefaults);
    campaigns.push(c1, c2);
  
    const adgroup1 = generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, {
      Campaign: [c1.Campaign],
      'Ad Group': [`${sourceData.industryKeyword[0]} - Exact`]
    })[0];
  
    const adgroup2 = generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, {
      Campaign: [c2.Campaign],
      'Ad Group': [`${sourceData.industryKeyword[0]} - Exact`]
    })[0];
  
    adGroups.push(adgroup1, adgroup2);
  
    const fullPrompt = `${addLevelPrompt}. the word that should be used for this task is ${JSON.stringify(sourceData.industryKeyword[0])}`;
    const gptResponse = await this.gptService.askGpt01(process.env.GPT_KEY, addLevelSystemMessage, fullPrompt);
    const [ad1, ad2] = extractHeadlinesAndDescriptions(gptResponse.choices[0].message.content, adsTemplateDefaults, sourceData.hostname, constantheadersAndDescriptions );
    ads.push(...generateFullAddObject([ad1, ad2], sourceData));
  
    keywords.push(
      generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, {
        Campaign: [c1.Campaign],
        'Ad Group': [adgroup1['Ad Group']],
        Keyword: [sourceData.industryKeyword[0]]
      })[0],
      generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, {
        Campaign: [c2.Campaign],
        'Ad Group': [adgroup2['Ad Group']],
        Keyword: [sourceData.industryKeyword[0]]
      })[0]
    );
  console.log('finishing box a');
  logToCloudWatch('finishing box a', 'INFO', 'GENERATE_ADS');
    //return { campaigns, adGroups, ads, keywords };
    return {
      campaigns: campaigns.map(c => ({ ...c, box: 'a' })),
      adGroups: adGroups.map(a => ({ ...a, box: 'a' })),
      ads: ads.map(ad => ({ ...ad, box: 'a' })),
      keywords: keywords.map(k => ({ ...k, box: 'a' }))
    };
  }
  async processBoxB(sourceData: googleAdsSourceData, constantheadersAndDescriptions: ConstantHeadersAndDescriptions) {
    const campaigns = [];
    const adGroups = [];
    const ads = [];
    const keywords = [];
  
    for (const word of sourceData.paretoKeywords) {
      const [campaignM, campaignD] = generateDualCampaignRows(word, campaignTemplateDefaults);
      campaigns.push(campaignM, campaignD);
  
      const adGroupName = `${word} - Exact`;
      const adGroupM = generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, {
        Campaign: [campaignM.Campaign],
        'Ad Group': [adGroupName]
      })[0];
  
      const adGroupD = generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, {
        Campaign: [campaignD.Campaign],
        'Ad Group': [adGroupName]
      })[0];
  
      adGroups.push(adGroupM, adGroupD);
  
      const fullPrompt = `${addLevelPrompt}. the word that should be used for this task is ${JSON.stringify(word)}`;
      const gptResponse = await this.gptService.askGpt01(process.env.GPT_KEY, addLevelSystemMessage, fullPrompt);
      const extractedAds = extractHeadlinesAndDescriptions(
        gptResponse.choices[0].message.content,
        adsTemplateDefaults,
        sourceData.hostname,
        constantheadersAndDescriptions,
      );

      if (extractedAds.length > 0) {
        ads.push(...generateFullAddObject(extractedAds, { industryKeyword: [word] }));
      } else {
        logToCloudWatch(`Skipping ads for ${word} in box b due to empty content`, 'WARN', 'GENERATE_ADS');
      }
  
      keywords.push(
        generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, {
          Campaign: [campaignM.Campaign],
          'Ad Group': [adGroupM['Ad Group']],
          Keyword: [word]
        })[0],
        generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, {
          Campaign: [campaignD.Campaign],
          'Ad Group': [adGroupD['Ad Group']],
          Keyword: [word]
        })[0]
      );
    }
    console.log('finishing box b');
    logToCloudWatch('finishing box b', 'INFO', 'GENERATE_ADS');

   // return { campaigns, adGroups, ads, keywords };
   return {
    campaigns: campaigns.map(c => ({ ...c, box: 'b' })),
    adGroups: adGroups.map(a => ({ ...a, box: 'b' })),
    ads: ads.map(ad => ({ ...ad, box: 'b' })),
    keywords: keywords.map(k => ({ ...k, box: 'b' }))
  };
  }




  async processBoxC(sourceData: googleAdsSourceData, constantheadersAndDescriptions: ConstantHeadersAndDescriptions) {

    try {
         
    const campaigns: any[] = [];
    const adGroups: any[] = [];
    const keywords: any[] = [];
    const ads: any[] = [];
  
    // Step 1: Get campaign segmentation response
    const fullPromptC = `${campaignLevelPrompt}. the word that should be used for this task is ${sourceData.genericKeywords}`;
    const gptResponse = await this.gptService.askGpt01(process.env.GPT_KEY, campaignLevelSystemMessage, fullPromptC);
  
    // Step 2: Extract campaign chunks
    let campaignsWithWords = gptResponse.choices[0].message.content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('####') || line.startsWith('-'));
  
    const campaignsWithWordsArray = JSON.stringify(campaignsWithWords).split('####').slice(1);
    const campaignNamesAndWords: CampaignWordsChunk[] = campaignsWithWordsArray.map(chunk => {
      const [campaignPart, ...keywordParts] = chunk.split('","');
      const name = campaignPart.replace(/^.*CAMPAIGN:\s*/, '').replace(/"$/, '').trim();
      const words = keywordParts.map(w => w.replace(/^- /, '').replace(/"$/, '').trim()).filter(Boolean);
      return { name, words };
    });
  
    // Step 3: Generate campaign rows
    for (let campaign of campaignNamesAndWords     ) { // 6

       const [row1, row2] = generateDualCampaignRows(campaign.name, campaignTemplateDefaults);
      campaigns.push(row1, row2);
    }
   
    // Step 4: For each campaign, get ad group and ad level data
    for (const wordsSet of campaignNamesAndWords    ) { //6
      logToCloudWatch(`generating ad group rows for ${wordsSet.name} box c`, 'INFO', 'GENERATE_ADS');
      await new Promise(resolve => setTimeout(resolve, 1000));
      const keywordList = wordsSet.words.map(w => `"${w}"`).join(', ');
      const fullPrompt = `${addGroupLevelPrompt}\n\nHere is the list of keywords to use:\n${keywordList}`;
      const gptResponse = await this.gptService.askGpt01(process.env.GPT_KEY, addGroupLevelSystemMessage, fullPrompt);
      const addGroupsWithWords = parseAdGroupBlocks(gptResponse.choices[0].message.content);
  
      const campaignM = `${wordsSet.name} | M`;
      const campaignD = `${wordsSet.name} | D`;
  
      const adLevelResults = await Promise.all(
        addGroupsWithWords.map(async ({ adGroup, keywords: kws }) => {
          logToCloudWatch(`generating ad level rows for ${adGroup} inner promise all  box c`, 'INFO', 'GENERATE_ADS');
          const fullPrompt = `${addLevelPrompt}. the words that should be used for this task is ${JSON.stringify(kws)}`;
          const gptResponse = await this.gptService.askGpt01(process.env.GPT_KEY, addLevelSystemMessage, fullPrompt);
          const extractedAds = extractHeadlinesAndDescriptions(
            gptResponse.choices[0].message.content,
            adsTemplateDefaults,
            sourceData.hostname,
            constantheadersAndDescriptions,
          );

          const preparedAds2 = extractedAds.length > 0
            ? generateFullAddObject2(extractedAds, { industryKeyword: [wordsSet.name], adGroupName: adGroup })
            : [];
        
          const adGroupRows = [
            generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, { Campaign: [campaignM], 'Ad Group': [adGroup] })[0],
            generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, { Campaign: [campaignD], 'Ad Group': [adGroup] })[0]
          ];
  
          const keywordRows = kws.flatMap(keyword => [
            generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, { Campaign: [campaignM], 'Ad Group': [adGroup], Keyword: [keyword] })[0],
            generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, { Campaign: [campaignD], 'Ad Group': [adGroup], Keyword: [keyword] })[0]
          ]);
           return { adGroupRows, keywordRows, preparedAds2 };
        })
      );
  
      // Collect all rows
      for (const result of adLevelResults) {
        adGroups.push(...result.adGroupRows);
        keywords.push(...result.keywordRows);
        if (result.preparedAds2.length > 0) {
          ads.push(...result.preparedAds2);
        } else {
          logToCloudWatch('Skipping empty ad set in box c', 'WARN', 'GENERATE_ADS');
        }
      }
    }
    logToCloudWatch('finishing box c', 'INFO', 'GENERATE_ADS');
   // return { campaigns, adGroups, keywords, ads };
   return {
    campaigns: campaigns.map(c => ({ ...c, box: 'c' })),
    adGroups: adGroups.map(a => ({ ...a, box: 'c' })),
    ads: ads.map(ad => ({ ...ad, box: 'c' })),
    keywords: keywords.map(k => ({ ...k, box: 'c' }))
  };
    }
    catch (error) {
      if (error.message.includes('429')) {
      await new Promise(resolve => setTimeout(resolve, 60000));
      }
      else {
        throw new Error(error.message);
      }
    }
  
  }
  
  
}