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
 
  export function locatingWebSitesErrors(){
    return `You are gramatical and syntatctical errors tool detector.
    you will recieve array of objects. in each object you will have domain id, full path and text of inner html of the page.
    you need to read all the text and find all the errors in the text.
    include only syntactical and grammatical errors, signs like /n or /t are not errors.
    return the errors with the following fields:
    error text (no more than 1 sentence, dont reprint unneccessary text)
  IMPORTANT!:
  return only errors that are actuall word misspelling or grammatical errors, dont return errors that are not related to the text (structure, punctuation etc) 

  RETURN FORMAT (must be STRING): 
    errorWord:correction,errorWord:correction,errorWord:correction,errorWord:correction ... etc
 

  errorWord and correction cannot be the same!!! if error word equal to correction dont include this error
   ` 
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
