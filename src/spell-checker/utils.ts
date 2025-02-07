import axios from 'axios';
import { AnyObject } from './consts';

export async function queryGoogleAds(domain: any, companies: AnyObject[], tokens:any, logger?: any) {
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
        console.log(domain.id);
        const msg = extractInfoFromGoogleAdsError(error);
        if (msg.includes(`The customer account can't be accessed because it is not yet enabled or has been deactivated)`)) {
            logger.error(`no domain.googleadsid for domain ${domain.id}  `);
        } else if (msg.includes(`Request contains an invalid argument., Invalid customer ID ''.`)) {
            logger.error(`Invalid customer ID ''. for domain ${domain.id}  `);
        } else if (msg.includes(`The caller does not have permission, The customer account can't be accessed because it is not yet enabled or has been deactivated`)) {
            logger.error(`The caller does not have permission, The customer account for domain ${domain.id} can't be accessed because it is not yet enabled or has been deactivated`);
        } else {
        }
        logger.error(domain.id + '  --  ' + msg);
    }
}

export function filterOutTextlessAds(result: AnyObject[]) {
    return result?.filter((r: AnyObject) => r.changeEvent.newResource?.ad?.responsiveSearchAd);
}

export function extractInfoFromGoogleAdsError(error: any) {
    return `${error.message}, ${error.response.data[0].error.message}, ${error.response.data[0].error.details[0].errors[0].message}  `;
}
