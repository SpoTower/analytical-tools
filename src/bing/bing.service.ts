import { Injectable } from '@nestjs/common';
import { CreateBingDto } from './dto/create-bing.dto';
import { UpdateBingDto } from './dto/update-bing.dto';
import { generateBingCreateOfflineConversionXml } from './consts';
import axios from 'axios';
import { XMLParser } from 'fast-xml-parser';
@Injectable()
export class BingService {



  async createConversionGoals(conversionActions: any, hostname: string, domainId: number) {



    /*
    console.log(conversionActions, hostname, domainId);
    const  xmlBody = generateBingCreateOfflineConversionXml(conversionActions, hostname, domainId, undefined, undefined);
    const response = await axios.post(`https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc`, xmlBody, {
      headers: {
          'Content-Type': 'text/xml',
          SOAPAction: 'AddConversionGoals',
      },
  });

  const parser = new XMLParser();
  const result = parser.parse(response.data);
  const isDuplicate = result?.['s:Envelope']?.['s:Body']?.['AddConversionGoalsResponse']?.PartialErrors?.BatchError?.Code;
  if (isDuplicate == 5317) throw  new Error(`Duplicate conversion goal name ${conversionName}`);

  const conversionGoalId = result?.['s:Envelope']?.['s:Body']?.['AddConversionGoalsResponse']?.['ConversionGoalIds']['a:long'];

  return conversionGoalId || null;
    */
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
