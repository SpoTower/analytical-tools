export function createObcConfigParams(conversions: { name: string; category: string; attributionModel: string, countingType: 'ONE_PER_CLICK' | 'MANY_PER_CLICK' }[]) {
    return conversions.map(({ name, category, attributionModel,countingType }) => ({
        create: {
            name, // ✅ dynamically inserted category
            type: 'UPLOAD_CLICKS',
            status: ConversionActionStatus.ENABLED,
            category, // ✅ dynamically inserted category https://developers.google.com/google-ads/api/reference/rpc/v17/ConversionActionCategoryEnum.ConversionActionCategory
            primary_for_goal: false,
 
            attributionModelSettings: {
                attributionModel  
            },
            valueSettings: {
                default_value: 0,
                always_use_default_value: true,
                default_currency_code: 'USD',
              },    
            countingType,
        },
    }));
}


export enum ConversionActionStatus {
    ENABLED = 'ENABLED',
    REMOVED = 'REMOVED',
}
