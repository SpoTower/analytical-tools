
export function traffic(device: string){
    return `SELECT campaign_id, domain_name, COUNT(*) AS clicks
    FROM tracker_visitors
    WHERE device = "${device}"
      AND utm_source IN ('GOOGLE', 'BING')
      AND DATE(created_at) = CURDATE() - INTERVAL 2 DAY
    GROUP BY campaign_id, domain_name
    HAVING COUNT(*) > 5
    `
}
 
export function campaignsNetworks(mobileIds: string){
 return `select * from kidon3_STG.campaigns_name_network WHERE campaign_id IN (${mobileIds})`
}
 