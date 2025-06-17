export interface BingConversionAction {
    "Conversion Name Action": string;
    "Type": string;
    "Goal Category": string;
    "Count Type": string;
    resourceName: string;
  }
  

  interface TextAsset {
    Id: number;
    Name: string;
    Type: 'TextAsset';
    Text: string;
  }
  
  interface AssetLink {
    Asset: TextAsset;
    AssetPerformanceLabel: string;
    EditorialStatus: string;
    PinnedField: string;
  }
  
  interface AdUrlList {
    "a:string": string;
  }
  
  export interface BingAd {
    AdFormatPreference: string; // e.g., 'All'
    DevicePreference: number; // e.g., 0
    EditorialStatus: string; // e.g., 'Active'
    FinalAppUrls: string;
    FinalMobileUrls: string;
    FinalUrlSuffix: string;
    FinalUrls: AdUrlList;
    ForwardCompatibilityMap: string;
    Id: number;
    Status: string; // e.g., 'Paused'
    TrackingUrlTemplate: string;
    Type: string; // e.g., 'ResponsiveSearch'
    UrlCustomParameters: string;
    Descriptions: {
      AssetLink: AssetLink[];
    };
    Headlines: {
      AssetLink: AssetLink[];
    };
    Domain: string;
    Path1: string;
    Path2: string;
  }