 
export interface Partner {
    id: number;
    name: string;
    invocaAdId?: string;
    defaultConversionValue?: number;
    status: string;
    priority: string;
    includeMergeSince: Date;
    note?: string;
    domainId: number;  // Instead of `@ManyToOne(() => Domain)`
    createdAt: Date;
    updatedAt: Date;
    obcResourceName?: string;
}

export interface Domain {
    id: number;
    hostname: string;
    googleAdsId?: string;
    bingAdsId?: string;
    domainTimezone?: string;
    status: any;  // Enum reference
    roiPercentage: number;
    createdAt: Date;
    updatedAt: Date;
    industry?: Industry; // Instead of `@ManyToOne`
    company?: Company;   // Instead of `@ManyToOne`
    partners?: Partner[]; // Instead of `@OneToMany`
    deletedAt?: Date;
    slackChannelId?: string;
    obcResourceName?: string;
    obcUniqueResourceName?: string;
    paths?: string[] ; // Instead of `@OneToMany`
    companyId?: number; // Instead of `@ManyToOne`
}

export interface Company {k
    id: number;
    name: string;
    googleDeveloperToken?: string;
    googleCustomerId?: string;
    googleClientEmail?: string;
    googlePrivateKey?: string;
    googleApiEmail?: string;
    bingClientId?: string;
    bingRefreshToken?: string; // Expires in 90 days
    bingDeveloperToken?: string; // Expires in 90 days
    bingAccountId?: string; // ID of the user
    bingClientSecret?: string; // From Azure Portal -> Certificates & secrets
    createdAt: Date;
    updatedAt: Date;
  }
  export interface Industry {
    id: number;
    name: string;
    createdAt: Date;
    updatedAt: Date;
    companies?: Company[]; // Replaces @OneToMany relationship
  }

  export interface Paths {
    domainId:number;
    id:number;
    path:string;
  }