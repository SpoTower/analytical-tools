import axios from "axios";


export async function bingCall   (xml: string, soapAction: string)  {
    return axios.post(
      'https://campaign.api.bingads.microsoft.com/Api/Advertiser/CampaignManagement/v13/CampaignManagementService.svc',
      xml,
      {
        headers: {
          'Content-Type': 'text/xml',
          SOAPAction: soapAction,
        },
      }
    );
  };

  export const ensureArray = <T>(input: T | T[] | undefined | null): T[] => {
    if (!input) return [];
    return Array.isArray(input) ? input : [input];
  };