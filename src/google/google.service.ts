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

@Injectable()
export class GoogleService {

  constructor(
     private readonly globalState: GlobalStateService,
     @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex,

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
        console.log(error);
      }
     
   const company = state.companies.find((c)=>c.id == state.domains.find((d)=>d.hostname == hostname).companyId)
   const domainGoogleAdsId = state.domains.find((d)=>d.hostname == hostname).googleAdsId
   const token = allTokens.find((t) => t.company === company.name)?.token

   for (const action of conversionActions) {
    logger.log( 'inserting conversion action:', action);
    const operations = createObcConfigParams([{ name: action['Conversions Name Action'], category: action['Conversion Category'], attributionModel: action['Attribution'],countingType: action['Type']  },]); //Attribution
      
    
  
    try {
      const result = await axios.post(`https://googleads.googleapis.com/v17/customers/${domainGoogleAdsId}/conversionActions:mutate`,
        { operations },
        { headers: { 'developer-token': company.googleDeveloperToken, Authorization: `Bearer ${token}`,'login-customer-id': company.googleCustomerId,},}
      );

      logger.log('conversion action :', result.data);
      return result.data;
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
}  

async updateConversionNamesKidonTable(conversionActions:any[],creationResult:any, domainId:number){
  logger.log('entering updateConversionNamesKidonTable');
  try {
    if (conversionActions.length === creationResult.results.length) {
      const dataToInsert = conversionActions.map((c, index) => ({
        resource_name: creationResult.results[index].resourceName,
        name: c['Conversions Name Action'],
        goal: 'secondary',
        domain_id: domainId
        
       }));
      let res = await this.kidonClient('conversion_name').insert(dataToInsert);
    } else{
      throw new Error('Error updating conversion names in kidon table: mismatch between conversion actions and creation results )');
    } 
  } catch (error) {
    logger.error(`Error updating conversion names in kidon table: ${error.message}`);
    throw new Error(`Error updating conversion names in kidon table: ${error.message}`);
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
}
