import { Injectable, Inject } from '@nestjs/common';
import { CreateBingDto } from './dto/create-bing.dto';
import { UpdateBingDto } from './dto/update-bing.dto';
import { generateBingCreateOfflineConversionXml } from './consts';
  import axios from 'axios';
  import { XMLParser } from 'fast-xml-parser';
  import * as KF from '@spotower/my-utils';
import { GlobalStateService } from 'src/globalState/global-state.service';
import {   KIDON_CONNECTION } from 'src/knex/knex.module';
import { Knex } from 'knex';
import { BingConversionAction } from './interfaces';
import { logToCloudWatch } from 'src/logger';
 @Injectable()
export class BingService {

  constructor(private readonly globalState: GlobalStateService,
    @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,
  ) {}

  async createConversionGoals(conversionActions: BingConversionAction[],   domainId: number) {
    logToCloudWatch('Entering createConversionGoals endpoint. '    );
    const state = this.globalState.getAllState();
    const domain = state.domains.filter((d)=>d.id == domainId)[0]
    let results = []
        const company = state.companies.find(c => c.id === domain.companyId);
        let accessToken = null
        try {accessToken = await KF.getBingAccessTokenFromRefreshToken(company);} catch{}
          

        // Get Bing account/customer IDs from the domain or company object
        const customAccountId = domain.bingAdsId 
        const customerId = company.bingAccountId
        const developerToken = company.bingDeveloperToken

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
