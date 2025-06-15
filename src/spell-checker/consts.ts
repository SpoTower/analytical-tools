import { Domain } from "domain";
export type AnyObject = {
    [key: string]: any; // Allows any key with any value type
};


export enum emailSubjects {
    GOOGLE_ADS_GRAMMATICAL_ERRORS = 'Google Ads Grammatical Errors',
    WEBSITES_GRAMMATICAL_ERRORS = 'Websites Grammatical Errors',
}
 

 


export function fixingGrammErrorsPrompt(spellcheckIgnoreList: string[]) {
    return `You are gramatical and syntatctical errors tool detector.

  read all the text i send you, find grammatical syntactical and semantical errors and return back the object (per error) with fields: 
  index of the row when you find error,
   location (headers/descriptions) of the error,
    id of the object that the error was founded within (id field on the same level with resourceName)),
     the error himself,   
     and proposition for fixing
  -  if the string contains words that are presented in ${spellcheckIgnoreList} ignore this row dont check it and dont include it in the response
  - first iterate over all the text fields in description fields, and then over all text arrays in the headers field
  - important!  all errors, no matter how much they are of same index should be returned in the same object
  examples: 
  example a) for example if you had this string:  extractedAds[0].descriptions[2].text = 'ceep Your Appliances Runned Wit the Right & Affordable Homey Warranty Program. Save Costs', 
  you see that there is 4 mistakes: ceep, Runned, Wit, Homey.
  so you should return one object with all 4 errors concatenated in it.
  example b) if you see  "10 Best Home Warranties {CUSTOMIZER.Year:2025}" you should ignore this row and dont return any errors for it, because CUSTOMIZER word is present in spellcheckIgnoreList
   `;
}
export function fixingGrammErrorsPrompt2( ) {
    return `You are gramatical and syntatctical errors tool detector.
    1) you are going to recieve 2 arrays of sentences (array of strings) (headlines and descriptions), and you are gonna recieve the id of the object that the sentences are related to
    2) you need iterate over each string in thes 2 arrays
    3) for each string you need to find all the errors in the text
    4) return strings that you found error in them.
     type here the original sentence,
      the errors and the fixes
      , and also the id of the object that the sentences are related to,
      and also the array name in which it appeared (headles or descriptions)
   5) if no error founded - ignore the line and dont return it.
   6) the errors you are returning me are per string in the headers and descriptions array. so if string in headers has 5 errors or 1 error you stil need to return only one object with multiple errors, and not multiple objects with 1 error
   `;

 
  
}
 
export function locatingWebSitesErrors() {
  return `You are a grammatical and spelling error detector.

You will receive an array of individual words (strings), each potentially extracted from a webpage.

Your task is to identify **only the words that contain actual spelling or grammatical errors**.

⚠️ IMPORTANT:
- Do NOT flag valid words, including British English variants (e.g., "licence", "colour").
- Do NOT return words that are spelled correctly or grammatically correct, even if uncommon.
- Return ONLY incorrect words — typos, misspellings, or invalid grammatical forms.

Format:
Return an array containing only the invalid words. If all words are valid, return an empty array [].

Example:
Input: ["licence", "tabli", "dog", "kat"]
Output: ["tabli", "kat"]

Input: ["color", "dog", "licence"]
Output: []

Be precise and return nothing if no real spelling/grammar mistakes exist.
`;
}

    
  export function locatingWebSitesErrors2(){
    return `
      find all the errors in the text. include only syntactical and grammatical errors, pretend that you are a teacher in english class and you need to correct the text.
      your answer should be
      - short
      - in jsin format
      - include the word with error, and the correction
    `
   }
  

 export const isWordsInEnglish = 'you recieve one sentence, the sentence can be in english or in other language. the sentence will have errors. ignore the errors and determine if the sentence is mostly in english language. answer ONLY yes or no'

 export const slackChannels = {
  CONTENT: 'C08EPQYR6AC',
  PERSONAL: 'C08GHM3NY8K',
 }
 
  export const lineupClassNames = ['partnersArea_main-partner-list', 'ConditionalPartnersList', 'test-id-partners-list','homePage_partners-list-section' ];


  export const invocaColumns = [
    'advertiser_campaign_id',
    'advertiser_id_from_network',
    'advertiser_campaign_id_from_network',
    'affiliate_payout_localized',
    'promo_line_description',
    'advertiser_campaign_name',
    'start_time_local',
    'start_time_xml',
    'start_time_network_timezone',
    'start_time_utc',
    'start_time_network_timezone_xml',
    'gclid',
    'duration',
    'media_type',
    'complete_call_id',
    'msclkid',
    'calling_phone_number',
    'custom_data',
    'customer.signal_custom_parameter_1',
    'landing_page',
    'utm_campaign',
    'utm_source',
    'utm_medium',
    'region',
    'connect_duration',
    'dynamic_number_pool_id',
    'advertiser_id_from_network',
    'advertiser_name',
    'advertiser_id',
    'call_source_description',
    'advertiser_name',
    'call_result_description_detail',
    'city',
    'mobile',
    'destination_phone_number',
    'calling_page',
    'uuid',
    'gbraid',
    'wbraid',
];

// ✅ Goal:
// Match strings The string contains D, (D), or +D
// but do not But does not contain M, (M), or +M
export const desktopOnlyTraffick = /^(?=.*(\+?D|\(D\)))(?!.*(\+?M|\(M\))).*$/;



  // ✅ Matches if:
  // Contains M or (M)
  // ❌ Fails if: 
  // Contains D, (D), or +D
  // 
 export const mobileOnlyTraffick = /^(?=.*\bM\b|\(M\))(?!.*(\+?D|\(D\))).*$/;


 // ✅ Matches if:
 //D, (D), +D
 //M, (M), +M
 
 export const hasMobileOrDesktop = /(\+?D|\(D\)|\+?M|\(M\))/;


// these are domains that when fetched from invoca transaction report the urls that contains them must be used fully and not just the base of them
// because without the full parameters the invoca tag will not appear in the partner website
 export const urlsWithParams=[
  'https://safeshipquotes.com',
  'https://naviautotransport.com',
  'https://chwprice.com',
  'https://try.anthemtaxes.net',
  'https://www.movingapt.com',
  'https://apply.amerisave.com',
  'https://quote.selecthomewarranty.com'
]