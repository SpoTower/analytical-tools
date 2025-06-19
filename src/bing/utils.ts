import axios, { AxiosResponse } from "axios";
import { generateGetAdGroupsByCampaignIdXml, generateGetAdsByAdGroupIdsXml } from "./consts";
import { processInBatches } from "src/spell-checker/utils";
import { generateBingGetCampaignsByAccountIdXml } from "./consts";
import { Company, Domain } from "src/kidonInterfaces/shared";
import { XMLParser } from "fast-xml-parser";
import { BingAdResult } from "./interfaces";
import { Knex } from "knex";
import * as KF from '@spotower/my-utils';


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


  export async function getAllBingAdUrlsAndText(validDomains: Domain[], companies: Company[], parser: XMLParser, isHeadlines?: boolean): Promise<BingAdResult[]> {
    const results: BingAdResult[] = [];
    const getCompanyById = (id: number) => companies.find(c => c.id === id);

    await processInBatches(
      validDomains.map(domain => async () => {
        const company = getCompanyById(domain.companyId);
        const customAccountId = domain.bingAdsId;
        const customerId = company.bingAccountId;
        const developerToken = company.bingDeveloperToken;
  
        const localResults: BingAdResult[] = [];
  
        const xmlCampaigns = generateBingGetCampaignsByAccountIdXml(company.accessToken, customAccountId, customerId, developerToken);
        const resCampaigns = await bingCall(xmlCampaigns, 'GetCampaignsByAccountId');
        const campaignsParsed = parser.parse(resCampaigns.data);
        const campaignIds = ensureArray(campaignsParsed?.['s:Envelope']?.['s:Body']?.GetCampaignsByAccountIdResponse?.Campaigns?.Campaign).map(c => c.Id);
  
        await Promise.all(campaignIds.map(async campaignId => {
          const xmlAdGroups = generateGetAdGroupsByCampaignIdXml(company.accessToken, customAccountId, customerId, developerToken, campaignId);
          const resAdGroups = await bingCall(xmlAdGroups, 'GetAdGroupsByCampaignId');
          const adGroupsParsed = parser.parse(resAdGroups.data);
          const adGroupIds = ensureArray(adGroupsParsed?.['s:Envelope']?.['s:Body']?.GetAdGroupsByCampaignIdResponse?.AdGroups?.AdGroup).map(c => c.Id);
  
          await Promise.all(adGroupIds.map(async adGroupId => {
            const xmlAds = generateGetAdsByAdGroupIdsXml(company.accessToken, customAccountId, customerId, developerToken, adGroupId);
            const resAds = await bingCall(xmlAds, 'GetAdsByAdGroupId');
            const adsParsed = parser.parse(resAds.data);
            const ads = ensureArray(adsParsed?.['s:Envelope']?.['s:Body']?.GetAdsByAdGroupIdResponse?.Ads?.Ad);
  
 
            const urls = ads.flatMap(ad =>
              ensureArray(ad?.FinalUrls?.['a:string']).map(url => {
                const base: BingAdResult = {
                  url,
                  domainId: domain.id,
                  campaignName:
                    campaignsParsed?.['s:Envelope']?.['s:Body']?.GetCampaignsByAccountIdResponse?.Campaigns?.Campaign?.find(c => c.Id === campaignId)?.Name || 'Unknown Campaign',
                  slackChannelId: domain.slackChannelId || ''
                };
            
                if (isHeadlines) {
                   base.headlines = ensureArray(ad?.Headlines?.AssetLink || []);
                   base.descriptions = ensureArray(ad?.Descriptions?.AssetLink || []);
                   base.id = ad.Id;
                   base.domain = ad?.Domain || ad?.BusinessName || '';
                }
            
                return base;
              })
            );
  
            localResults.push(...urls);
          }));
        }));
  
        results.push(...localResults);
      }),
      5
    );
  
    return results; 
  }
 

  export async function getBingValidDomainsWithTokens(kidonClient: Knex, domainId?: number) {
    const domains = await kidonClient('domain');
    const companies = await kidonClient('companies');
  
    let validDomains = domains.filter(d => !!d.bingAdsId);
    if (domainId) {
      validDomains = validDomains.filter(d => d.id == domainId);
    }
  
    await Promise.all(validDomains.map(async (domain) => {
      const company = companies.find(c => c.id === domain.companyId);
      if (!company) return;
  
      try {
        company.accessToken = await KF.getBingAccessTokenFromRefreshToken(company);
      } catch {
        return;
      }
    }));
  
    return { validDomains, companies };
  }