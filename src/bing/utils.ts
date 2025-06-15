 

import axios, { AxiosResponse } from "axios";


export async function bingCall(xml: string, soapAction: string, retries = 3): Promise<AxiosResponse> {
    const url = 'https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc';
  
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await axios.post(url, xml, {
          headers: {
            'Content-Type': 'text/xml',
            'SOAPAction': soapAction,
          },
          timeout: 15000,
        });
      } catch (error) {
        if (attempt === retries) throw error;
        await new Promise(r => setTimeout(r, 1000 * attempt)); // backoff
      }
    }
  }
  
  export const ensureArray = <T>(input: T | T[] | undefined | null): T[] => {
    if (!input) return [];
    return Array.isArray(input) ? input : [input];
  };