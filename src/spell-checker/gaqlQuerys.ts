export let googleAdsGrammarErrors = `
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
                change_event.change_date_time BETWEEN  '<startDate>' AND '<endDate>'
            AND
                change_event.resource_change_operation IN (CREATE, UPDATE)
            AND
                 change_event.change_resource_type IN ('AD' )
             LIMIT 10000
`
 
export let googleAdsLandingPageQuery = `
SELECT
  ad_group_ad.ad.id,
  ad_group_ad.ad.name,
  ad_group_ad.status,
  ad_group_ad.ad.final_urls,
  ad_group.name,
  campaign.name,
  campaign.id,
  metrics.impressions
FROM ad_group_ad
WHERE
  ad_group_ad.status = 'ENABLED'
  AND campaign.status = 'ENABLED'
  AND ad_group.status = 'ENABLED'
  AND metrics.impressions > 1
`
