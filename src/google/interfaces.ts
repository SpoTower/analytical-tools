export interface conversionActions {
    ConversionNameAction: string;
    type: 'Once' | 'Every' 
    ConversionCategory: string;
}
export interface googleAdsSourceData {
    campaignCount: string;
    keywords: string[];
}