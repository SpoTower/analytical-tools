import { Injectable, Inject } from '@nestjs/common';
import { CreateBingDto } from './dto/create-bing.dto';
import { UpdateBingDto } from './dto/update-bing.dto';
import { generateBingCreateOfflineConversionXml, generateBingGetCampaignsByAccountIdXml, generateGetAdGroupsByCampaignIdXml, generateGetAdsByAdGroupIdsXml } from './consts';
  import axios from 'axios';
  import { XMLParser } from 'fast-xml-parser';
  import * as KF from '@spotower/my-utils';
import { GlobalStateService } from 'src/globalState/global-state.service';
import {   KIDON_CONNECTION } from 'src/knex/knex.module';
import { Knex } from 'knex';
import { BingAd, BingConversionAction } from './interfaces';
import { logToCloudWatch } from 'src/logger';
import { bingCall, ensureArray, getAllBingAdUrlsAndText, getBingValidDomainsWithTokens } from './utils';
import { extractUniqueBaseUrls, processInBatches } from 'src/spell-checker/utils';
 
 @Injectable()
export class BingService {

  constructor(private readonly globalState: GlobalStateService,
    @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,
  ) {}
  async createConversionGoals(conversionActions: BingConversionAction[],   domainId: number) {
    logToCloudWatch('Entering createConversionGoals endpoint. '    );
    const domain  = await this.kidonClient('domain').where('id', domainId).first();
    const company  = await this.kidonClient('companies').where('id', domain.companyId).first();
     let results = []
         let accessToken = null
        try {accessToken = await KF.getBingAccessTokenFromRefreshToken(company);} catch{}
          

        // Get Bing account/customer IDs from the domain or company object
        const customAccountId = domain.bingAdsId 
        const customerId = company.bingAccountId
        const developerToken = company.bingDeveloperToken

        if(!customAccountId || !customerId || !developerToken){
          throw new Error(`Bing account/customer IDs or developer token is missing for company: ${company?.name}`);
        }

        for (const action of conversionActions) {
          logToCloudWatch(`Creating conversion goal for ${action["Conversion Name Action"]} in for loop`, 'INFO', 'bing');

          const  xmlBody = generateBingCreateOfflineConversionXml(accessToken, customAccountId, customerId, developerToken, action);
          logToCloudWatch(`XML body: ${JSON.stringify(xmlBody)}`, 'INFO', 'bing');
          const response = await axios.post(`https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc`, xmlBody, {
            headers: {
                'Content-Type': 'text/xml',
                SOAPAction: 'AddConversionGoals',
            },
        });

        const parser = new XMLParser();
        const result = parser.parse(response.data);
        const isDuplicate = result?.['s:Envelope']?.['s:Body']?.['AddConversionGoalsResponse']?.PartialErrors?.BatchError?.Code;
         if (isDuplicate == 5317) throw  new Error(`Duplicate conversion goal name ${action["Conversion Name Action"]}, this and all proceeding conversion names were not created`);

        const conversionGoalId = result?.['s:Envelope']?.['s:Body']?.['AddConversionGoalsResponse']?.['ConversionGoalIds']['a:long'];

      //Save to db
      if(conversionGoalId){
          await this.kidonClient('conversion_names_bing').insert({name: action["Conversion Name Action"], goal: 'secondary',status: 'Active', count: action["Count Type"], domain_id: domainId, resource_name: conversionGoalId, });
          results.push(conversionGoalId)
          logToCloudWatch(`Conversion goal created for ${action["Conversion Name Action"]} with ID: ${conversionGoalId}`, 'INFO', 'bing');
      }else{
        logToCloudWatch(`Conversion goal not created for ${action["Conversion Name Action"]} ${JSON.stringify(result)}`, 'INFO', 'bing');
      }
   
      }

        return results
 
     
  }





async saveBingUrls(domainId?: number, isHeadlines?: boolean): Promise<string> {

logToCloudWatch('Entering saveBingUrls endpoint. '    );
   const parser = new XMLParser();

  const { validDomains, companies } = await getBingValidDomainsWithTokens(this.kidonClient, domainId);
 let results = await getAllBingAdUrlsAndText(validDomains, companies, parser,isHeadlines)
 
  const uniqueResultsFromBing = Array.from(new Map(results.map(item => [`${item.url}|${item.domainId}`, item])).values()); 
  const existingBingUrlsFromDb = await this.kidonClient('bing_landing_pages') 
  const existingSet = new Set(existingBingUrlsFromDb.map(item => `${item.url}|${item.domainId}`) );
  const newResults = uniqueResultsFromBing.filter(item => !existingSet.has(`${item.url}|${item.domainId}`));
  if(newResults.length > 0){
    await this.kidonClient('bing_landing_pages').insert(newResults);
  }
  logToCloudWatch(`Bing urls saved for ${newResults.length} domains`, 'INFO', 'bing');
  return  `Bing urls saved for ${newResults.length} domains`;
}


 async getBingUrls(domainId?: number, originOnly?: boolean)  {
  const results = domainId ? await this.kidonClient('bing_landing_pages').where('domain_id', domainId) : await this.kidonClient('bing_landing_pages')
  const urls = results.map((r)=>r.url)
  if(!originOnly){
    return urls;
   }
   const uniqueBaseUrls = extractUniqueBaseUrls(urls);
  return uniqueBaseUrls;
}

  async updateConversionNamesKidonTable(conversionActions: BingConversionAction[],  resourceNames: string[], domainId: number) {
    logToCloudWatch('Entering updateConversionNamesKidonTable endpoint. '    );
 
  // attaching the resource name from bing response to the conversion action
    conversionActions = conversionActions.map((action, index) => ({
      ...action,
      resourceName: resourceNames[index],
    }));

    const transformed = conversionActions.map((action) => ({
      name: action["Conversion Name Action"],
      goal: 'secondary', // or use logic to determine this
      status: 'Active', // or extract from action if exists
      count: action["Count Type"],
      domain_id: domainId, // must be passed to the function
      resource_name: action.resourceName,
    }));
    
    let res =  await this.kidonClient('conversion_names_bing').insert(transformed);
    logToCloudWatch(`Conversion names updated for ${conversionActions.length} conversion goals`, 'INFO', 'bing');
  }


  create(createBingDto: CreateBingDto) {
    return 'This action adds a new bing';
  }

  findAll() {
    return `This action returns all bing`;
  }

  findOne(id: number) {
    return `This action returns a #${id} bing`;
  }

  update(id: number, updateBingDto: UpdateBingDto) {
    return `This action updates a #${id} bing`;
  }

  remove(id: number) {
    return `This action removes a #${id} bing`;
  }
}
