import axios from 'axios';
import { AnyObject } from './consts';
import { logToCloudWatch } from 'src/logger';
import { log } from 'console';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
export async function fetchGoogleAds(domain: any, companies: AnyObject[], tokens:any, logger?: any) {
    logToCloudWatch(`Entering fetchGoogleAds, fetching google ads for domain ${domain.id}`);
    try {
        const changeEventResult = await axios.post(
            `https://googleads.googleapis.com/v16/customers/${domain.googleAdsId}/googleAds:searchStream`,
            {
                query: `
                SELECT
                change_event.resource_name,   
                change_event.change_date_time,  
                change_event.change_resource_name,  
                change_event.resource_change_operation,   
                change_event.changed_fields,  
                change_event.old_resource,  
                change_event.new_resource  
            FROM change_event
            WHERE
                change_event.change_date_time BETWEEN '2025-01-10' AND '2025-02-04'
            AND
                change_event.resource_change_operation IN (CREATE, UPDATE)
            AND
                 change_event.change_resource_type IN ('AD', 'AD_GROUP_AD')
             LIMIT 10000
                `,
            },
            {
                headers: {
                    'developer-token': companies.find((c)=>c.id == domain.company ).googleDeveloperToken,
                    Authorization: `Bearer ${tokens.find((t) => t.company ==  companies.find((c)=>c.id == domain.company ).name ).token}`,
                    'login-customer-id': companies.find((c)=>c.id == domain.company ).googleCustomerId,
                },
            }
        );
        return changeEventResult?.data[0]?.results || [];
    } catch (error) {
         const msg = extractInfoFromGoogleAdsError(error);
         logToCloudWatch(`Error fetching google ads for domain ${domain.id}: ${msg}`);
        if (msg.includes(`The customer account can't be accessed because it is not yet enabled or has been deactivated)`) ||
            msg.includes(`Request contains an invalid argument., Invalid customer ID ''.`) ||
            msg.includes(`The caller does not have permission, The customer account can't be accessed because it is not yet enabled or has been deactivated`)
        )  throw new BadRequestException(msg)
        else throw new InternalServerErrorException(msg);
    }
}

export function filterOutTextlessAds(result: AnyObject[]) {
    return result?.filter((r: AnyObject) => r.changeEvent.newResource?.ad?.responsiveSearchAd);
}

export function extractInfoFromGoogleAdsError(error: any) {
    return `${error.message}, ${error.response.data[0].error.message}, ${error.response.data[0].error.details[0].errors[0].message}  `;
}


export function prepareAdsForGpt(textfullAds: Record<string, any>[]) {
    logToCloudWatch(`Entering prepareAdsForGpt, found ${textfullAds?.length} ads`);
    return textfullAds.map((t) => ({
        id: parseInt(t.changeEvent.changeResourceName.split('/').pop(), 10), // Extract Ad ID from resource name
        resourceName: t.changeEvent.changeResourceName, // Use correct resource name
        headlines: t.changeEvent.newResource?.ad?.responsiveSearchAd?.headlines || [], // Get new headlines if available, fallback to old
        descriptions: t.changeEvent.newResource?.ad?.responsiveSearchAd?.descriptions || [], // Get new descriptions if available, fallback to old
        changeDateTime: t.changeEvent.changeDateTime, // When the change happened
        resourceChangeOperation: t.changeEvent.resourceChangeOperation, // Type of change (CREATE, UPDATE, REMOVE)
        changedFields: t.changeEvent.changedFields.split(','), // List of changed fields
    }));
}