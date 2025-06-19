import { Knex } from "knex";
import { logToCloudWatch } from 'src/logger';
import { Domain } from "../interfaces";
export async function lineupPartnersValidation(kidonClient: Knex) {
    try {
        let domains = await  kidonClient.raw('select * from domain') ;
        domains = domains[0].map((d:Domain)=>d.hostname)
        const crudeUrls = await kidonClient.select('user_clicked_link').from('tracker_clicks').where('created_at', '>', new Date(Date.now() - 1000 * 60 * 60 * 10000  )) 
         const urls = crudeUrls.map((cu)=>cu.userClickedLink)
        // ✅ Step 1: filter out domains that are in the domains table (checking partner websites and not our websites)
        let partnerUrls = urls.filter(lp =>!domains.some(d => lp.includes(d)));   

        // ✅ Step 1: filter out domains that are in the domains table (checking partner websites and not our websites)
  console.log(partnerUrls)
    } catch (error) {
        logToCloudWatch(`Error fetching crude urls: ${JSON.stringify(error)}`, "ERROR", 'lineup partners validation');
        throw error;
    }
}