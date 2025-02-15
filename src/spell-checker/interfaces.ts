import { Domain  } from 'src/kidonInterfaces/shared';


export interface websiteText{
    domain:number,
    fullPath:string,
    innerHtml:string
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
  
  