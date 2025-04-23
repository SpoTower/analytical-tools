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

                export let googleAdsYearsErrors = `
                SELECT
                    ad_group_ad.ad.id,
                    ad_group_ad.ad.type,
                    ad_group_ad.ad.responsive_search_ad.headlines,
                    ad_group_ad.ad.responsive_search_ad.descriptions,
                    ad_group_ad.ad.expanded_text_ad.headline,
                    ad_group_ad.ad.expanded_text_ad.description1,
                    ad_group_ad.ad.expanded_text_ad.description2,
                    campaign.name
                FROM ad_group_ad
                WHERE 
                    ad_group_ad.status = 'ENABLED'
                    AND campaign.status = 'ENABLED'
                LIMIT 10000
            `
            