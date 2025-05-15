export interface conversionActions {
    ConversionNameAction: string;
    type: 'Once' | 'Every' 
    ConversionCategory: string;
}
export interface googleAdsSourceData {
    industryKeyword: string[]   // corresponds to textarea 1
    paretoKeywords: string[]    // corresponds to textarea 2
    genericKeywords: string[]   // corresponds to textarea 3
    hostname: string       // number input from frontend
  }

  export interface CampaignTemplate {
    Campaign: string
    'Campaign Type': 'Search'
    Networks: 'Google search'
    Budget: '10'
    'Budget type': 'Daily'
    'Standard conversion goals': 'Account-level'
    'Customer acquisition': 'Bid equally'
    Languages: 'en'
    'Bid Strategy Type': 'Maximize conversions'
    'Bid Strategy Name': string
    'Target CPA': '5'
    'Broad match keywords': 'Off'
    'Ad Schedule': '[]'
    'Ad rotation': 'Optimize for clicks'
    'Content exclusions': '[]'
    'Targeting method': 'Location of presence'
    'Exclusion method': 'Location of presence'
    'Audience targeting': 'Audience segments'
    'Flexible Reach': 'Audience segments'
    'Campaign Status': 'Paused'
  }
  
  
  export interface AdGroupTemplate {
    Campaign: string
    'Ad Group': string
    Labels: string
    'Max CPC': '0.01'
    'Max CPM': '0.01'
    'Target CPA': string
    'Max CPV': '0.01'
    'Target CPV': string
    'Percent CPC': '0.01'
    'Target CPM': string
    'Target ROAS': string
    'Desktop Bid Modifier': string
    'Mobile Bid Modifier': string
    'Tablet Bid Modifier': string
    'TV Screen Bid Modifier': string
    'Display Network Custom Bid Type': 'None'
    'Optimized targeting': 'Disabled'
    'Strict age and gender targeting': 'Disabled'
    'Ad rotation': string
    'Ad Group Type': 'Standard'
    Languages: 'All'
    'Audience targeting': 'Audience segments'
    'Audience name': string
    'Age demographic': string
    'Gender demographic': string
    'Income demographic': string
    'Parental status demographic': string
    'Remarketing audience segments': string
    'Interest categories': string
    'Life events': string
    'Custom audience segments': string
    'Detailed demographics': string
    'Remarketing audience exclusions': 'Audience segments;Genders;Ages;Parental status;Household incomes'
    'Flexible Reach': string
    'Tracking template': string
    'Final URL suffix': string
    'Custom parameters': string
    'Campaign Status': 'Paused'
    'Ad Group Status': 'Enabled'
    Comment: string
  }
  
  export interface AdsTemplate {
    Campaign: string
    'Ad Group': string
    'Ad type': 'Responsive search ad'
    Labels: string
    'Headline 1': string
    'Headline 1 position': string
    'Headline 2': string
    'Headline 2 position': string
    'Headline 3': string
    'Headline 3 position': string
    'Headline 4': string
    'Headline 4 position': string
    'Headline 5': string
    'Headline 5 position': string
    'Headline 6': string
    'Headline 6 position': string
    'Headline 7': string
    'Headline 7 position': string
    'Headline 8': string
    'Headline 8 position': string
    'Headline 9': string
    'Headline 9 position': string
    'Headline 10': string
    'Headline 10 position': string
    'Headline 11': string
    'Headline 11 position': string
    'Headline 12': string
    'Headline 12 position': string
    'Headline 13': string
    'Headline 13 position': string
    'Headline 14': string
    'Headline 14 position': string
    'Headline 15': string
    'Headline 15 position': string
    'Description 1': string
    'Description 1 position': 'Rates'
    'Description 2': string
    'Description 2 position': 'fha_loan'
    'Description 3': string
    'Description 3 position': 'https://tophomewarrantyservices.com/'
    'Description 4': string
    'Description 4 position': string
    'Path 1': string
    'Path 2': string
    'Final URL': string
    'Campaign Status': 'Paused'
    'Ad Group Status': 'Enabled'
    Status: 'Enabled'
  }
  
  export interface KeywordTemplate {
    Campaign: string
    'Ad Group': string
    Keyword: string
    'Criterion Type': 'Exact'
    'Campaign Status': 'Paused'
    'Ad Group Status': 'Enabled'
    Status: 'Enabled'
    'Approval Status': 'Approved'
    Comment: string
  }
  

  export interface CampaignWordsChunk {
    name: string;
    words: string[];
  }
  export interface ConstantHeadersAndDescriptions {
    /** Array of headlines to use in ads */
    headlines: string[];
    
    /** Array of descriptions to use in ads */
    descriptions: string[];
  }