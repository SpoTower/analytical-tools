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
import {googleAdsSourceData,CampaignWordsChunk} from './interfaces'
import { GptService } from 'src/gpt/gpt.service';
import {campaignLevelSystemMessage,campaignLevelPrompt,exampleResponseCampaigns,addGroupLevelSystemMessage,addGroupLevelPrompt,addLevelSystemMessage,addLevelPrompt} from './prompts'
import {generateRowsUsinObjectTemplate,extractHeadlinesAndDescriptions,exportToCsv,generateFullAddObject,extractCampaignChunks,parseAdGroupBlocks,generateDualCampaignRows} from './utils/generateAds'
import { keywordTemplateDefaults,adsTemplateDefaults,adGroupTemplateDefaults,campaignTemplateDefaults } from './adsConsts';
@Injectable()
export class GoogleService {

  constructor(
     private readonly globalState: GlobalStateService,
     @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,
     private readonly gptService: GptService,
     ) {}

     //create conversion action on hostname
  async createConversionActions(conversionActions: conversionActions[], hostname:string) {
    logger.log('entering createConversionActions');
      const state = this.globalState.getAllState();
      if (!state) return 'No state found';
      let allTokens
      try {
            allTokens = await Promise.all(state.companies.map(async (c) => ({ company: c.name,token: await KF.getGoogleAuthToken(c)})));
      } catch (error) { 
        logger.log(error);
      }
     
   const company = state.companies.find((c)=>c.id == state.domains.find((d)=>d.hostname == hostname).companyId)
   const domainGoogleAdsId = state.domains.find((d)=>d.hostname == hostname).googleAdsId
   const token = allTokens.find((t) => t.company === company.name)?.token
   const results = [];

   for (const action of conversionActions) {
    logger.log( 'inserting conversion action:', action);
    const operations = createObcConfigParams([{ name: action['Conversions Name Action'], category: action['Conversion Category'], attributionModel: action['Attribution'],countingType: action['Type']  },]); //Attribution
      
    
  
    try {
      const result = await axios.post(`https://googleads.googleapis.com/v17/customers/${domainGoogleAdsId}/conversionActions:mutate`,
        { operations },
        { headers: { 'developer-token': company.googleDeveloperToken, Authorization: `Bearer ${token}`,'login-customer-id': company.googleCustomerId,},}
      );

      logger.log('conversion action :', result.data);
      results.push(result.data);
    } catch (error) {
      logger.log(error.response?.data?.error?.message ||   error.response?.data?.error?.details?.[0]?.errors?.[0]?.message || error.response?.data?.error?.message)
      if (error.response?.data?.error?.message) {
        const errorMessage = error.response?.data?.error?.details?.[0]?.errors?.[0]?.message;
        if(errorMessage)     
            throw new Error(`Error for action "${action['Conversions Name Action']}": ${errorMessage}. remove the duplicate name from the csv file and try again`)
        else
         throw new Error(error.response?.data?.error?.message)
       }
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
    
 let campaigns = []
 let adGroups = []
  let ads = []
  let keywords = []
//TODO box A

    //Campaign object fill
   const [c1, c2] = generateDualCampaignRows(sourceData.industryKeyword[0], campaignTemplateDefaults);
   campaigns.push(c1, c2);

     //Addgroup object fill  
    let adgroup1 = generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, {Campaign: [`${sourceData.industryKeyword[0]} | M`], 'Ad Group': [`${sourceData.industryKeyword[0]} - Exact`]});
    let adgroup2 = generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, {Campaign: [`${sourceData.industryKeyword[0]} | D`], 'Ad Group': [`${sourceData.industryKeyword[0]} - Exact`]});
   
    adGroups.push(adgroup1[0]);
    adGroups.push(adgroup2[0]);
 
    //Adds  object fill   +  gpt(addLevelPrompt)
    const fullAddLevelPrompt = `${addLevelPrompt}. the word that should be used for this task is ${JSON.stringify(sourceData.industryKeyword[0])}`;
    let res = await this.gptService.askGpt01(process.env.GPT_KEY, addLevelSystemMessage, fullAddLevelPrompt)
    const [ad1, ad2] = extractHeadlinesAndDescriptions(res.choices[0].message.content, adsTemplateDefaults)
    const allAds = generateFullAddObject([ad1, ad2], sourceData);  
    ads.push(...allAds);


    //keywords
    let keyword1 = generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, {Campaign: [`${sourceData.industryKeyword[0]} | M`], 'Ad Group': [adgroup1[0]['Ad Group']], 'Keyword': [sourceData.industryKeyword[0]]});
    let keyword2 = generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, {Campaign: [`${sourceData.industryKeyword[0]} | D`], 'Ad Group': [adgroup2[0]['Ad Group']], 'Keyword': [sourceData.industryKeyword[0]]});
    keywords.push(keyword1[0]);
    keywords.push(keyword2[0]);



//TODO box B. exact replication of box a functionality, just iterating over x words and not 1 word


for (const word of sourceData.paretoKeywords) {
  const [campaignM, campaignB] = generateDualCampaignRows(word, campaignTemplateDefaults);
  campaigns.push(campaignM, campaignB);

  const adGroupName = `${word} - Exact`;
  const adGroupM = generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, { Campaign: [campaignM.Campaign], 'Ad Group': [adGroupName] })[0];
  const adGroupB = generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, { Campaign: [campaignB.Campaign], 'Ad Group': [adGroupName] })[0];
  adGroups.push(adGroupM, adGroupB);

  const fullPrompt = `${addLevelPrompt}. the word that should be used for this task is ${JSON.stringify(word)}`;
  const gptResponse = await this.gptService.askGpt01(process.env.GPT_KEY, addLevelSystemMessage, fullPrompt);
  const [ad1, ad2] = extractHeadlinesAndDescriptions(gptResponse.choices[0].message.content, adsTemplateDefaults);
  const preparedAds = generateFullAddObject([ad1, ad2], { industryKeyword: [word] });
  ads.push(...preparedAds);

  const keywordM = generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, { Campaign: [campaignM.Campaign], 'Ad Group': [adGroupM['Ad Group']], Keyword: [word] })[0];
  const keywordB = generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, { Campaign: [campaignB.Campaign], 'Ad Group': [adGroupB['Ad Group']], Keyword: [word] })[0];
  keywords.push(keywordM, keywordB);
}


//TODO box C

const fullPromptC = `${campaignLevelPrompt}. the word that should be used for this task is ${sourceData.genericKeywords}`;
const gptResponse = await this.gptService.askGpt01(process.env.GPT_KEY, campaignLevelSystemMessage, fullPromptC);
let campaignsWithWords = gptResponse.choices[0].message.content.split('\n') .map(line => line.trim()).filter(line => line.startsWith('####') || line.startsWith('-')) // ?? const lines

     const campaignsWithWordsArray = JSON.stringify(campaignsWithWords).split('####').slice(1);  //?? arr
      let campaignNamesAndWords = campaignsWithWordsArray.map(chunk => {
        const [campaignPart, ...keywordParts] = chunk.split('","');
        const name = campaignPart.replace(/^.*CAMPAIGN:\s*/, '').replace(/"$/, '').trim();
        const words = keywordParts.map(w => w.replace(/^- /, '').replace(/"$/, '').trim()) .filter(Boolean); 
        return { name, words };
      });


      // filling campaigns csv with 4-6 campaign names
      for (const campaign of campaignNamesAndWords as CampaignWordsChunk[]) {
        const [row1, row2] = generateDualCampaignRows(campaign.name, campaignTemplateDefaults);
        campaigns.push(row1, row2);
}
        
      

        //fill add groups
      for (const wordsSet of campaignNamesAndWords as CampaignWordsChunk[]) {  // 4-6 loops
        const keywordList = wordsSet.words.map(w => `"${w}"`).join(', ');
        const fullPrompt = `${addGroupLevelPrompt}\n\nHere is the list of keywords to use:\n${keywordList}`;
        const gptResponse = await this.gptService.askGpt01(process.env.GPT_KEY, addGroupLevelSystemMessage, fullPrompt);
        const addGroupsWithWords = parseAdGroupBlocks(gptResponse.choices[0].message.content);  //?? look for const addGroupsWithWords
      
                // ?? last call to jpt with add group words -> add level prompt + filling addgroups,adds and keywords

                const campaignM = `${wordsSet.name} | M`;
                const campaignD = `${wordsSet.name} | D`;
              
                const adLevelResults = await Promise.all(
                  addGroupsWithWords.map(async ({ adGroup, keywords: kws }) => {
                    const fullPrompt = `${addLevelPrompt}. the words that should be used for this task is ${JSON.stringify(kws)}`;
                    const gptResponse = await this.gptService.askGpt01(process.env.GPT_KEY, addLevelSystemMessage, fullPrompt);
                    const [ad1, ad2] = extractHeadlinesAndDescriptions(gptResponse.choices[0].message.content, adsTemplateDefaults);
                    const preparedAds = generateFullAddObject([ad1, ad2], { industryKeyword: [wordsSet.name] });
              
                    const adGroupRows = [
                      generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, { Campaign: [campaignM], 'Ad Group': [adGroup] })[0],
                      generateRowsUsinObjectTemplate(adGroupTemplateDefaults, 1, { Campaign: [campaignD], 'Ad Group': [adGroup] })[0]
                    ];
              
                    const keywordRows = kws.flatMap(keyword => [
                      generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, { Campaign: [campaignM], 'Ad Group': [adGroup], Keyword: [keyword] })[0],
                      generateRowsUsinObjectTemplate(keywordTemplateDefaults, 1, { Campaign: [campaignD], 'Ad Group': [adGroup], Keyword: [keyword] })[0]
                    ]);
              
                    return { adGroupRows, keywordRows, preparedAds };
                  })
                );
              
                for (const result of adLevelResults) {
                  adGroups.push(...result.adGroupRows);
                  keywords.push(...result.keywordRows);
                  ads.push(...result.preparedAds);
                }
      }


      console.log('ads:', ads);
      console.log('keywords:', keywords);
      console.log('adGroups:', adGroups);
      console.log('campaigns:', campaigns);
    
 
 
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
}
