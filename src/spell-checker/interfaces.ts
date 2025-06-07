import { Domain  } from 'src/kidonInterfaces/shared';


export interface websiteText{
    domain:number,
    fullPath:string,
    innerHtml:string,
    detectedErrors?:string[],
    outdatedYears?:string[],
    titleElement?:string 
}

export interface gptProposal{
    domain:number,
    path:string,
    errors:string
    jsonErrors?:any
}


export type adsForGpt = {
    id: number;
    changeDateTime: string;
    changedFields: string[];
    descriptions: Record<string, any>[]; // the actual ads text
    headlines: Record<string, any>[]; // the actual ads headers text
    resourceChangeOperation : string;
    resourceName : string;
}
export interface googleAds {
    domain: Domain;
    ads: any[];
   }
  
  
   export interface adsPreparedForErrorDetection {
    changeDateTime: string; // Timestamp as a string
    changedFields: string[]; // List of changed fields
    descriptions: { text: string }[]; // Array of objects containing text
    domain: string; // Domain name
    googleAdsId: string; // Google Ads ID
    headlines: { text: string }[]; // Array of objects containing text
    id: number; // Unique ad ID
    resourceChangeOperation: 'CREATE' | 'UPDATE' | 'REMOVE'; // Operation type
    resourceName: string; // Full resource name
}

export interface BqTrafficCampaign {
    domain_name: string;
    domain_id: number;
    campaign_id: number;
    campaign_name: string;
    date: {
      value: string; // e.g. '2025-06-04'
    };
    device: 'MOBILE' | 'DESKTOP';
    media_source: string;
    network_letter: string;
    network_type: string;
  }
  

  export interface SqlCampaignTraffic {
    campaign_id: string;
    clicks: number;
    domain_name: string;
  }

  export interface pageContentMetaData {
    domain:number;
    fullPath:string;
    innerHtml: string;
    titleElement?: string;
    detectedErrors?: string[]
    outdatedYears?: string[]
  }
 