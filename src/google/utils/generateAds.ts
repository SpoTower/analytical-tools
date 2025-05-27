import { promises as fs } from 'fs'
import * as path from 'path'
import { ConstantHeadersAndDescriptions } from '../interfaces'

// Utility to enforce length and replace years
function cleanAdText(text: string, maxLength: number): string {
  // First remove any trailing character count like "(24)" or " - 24 characters"
  let cleaned = text
    .replace(/\s*-\s*\d+\s*characters?$/, '')  // Remove " - XX characters"
    .replace(/\s*\(\d+\)$/, '')                // Remove "(XX)"
    .replace(/\s*-\s*\d+$/, '');               // Remove " - XX"

  // Replace years with {CUSTOMIZER.Year}
  cleaned = cleaned.replace(/\b(19|20)\d{2}\b/g, '{CUSTOMIZER.Year}');
  
  // Check if we have any {CUSTOMIZER.Year} in the text
  const customizerMatches = cleaned.match(/{CUSTOMIZER\.Year}/g);
  const customizerCount = customizerMatches ? customizerMatches.length : 0;
  
  // Only adjust length if we actually have {CUSTOMIZER.Year} in the text
  if (customizerCount > 0) {
    const customizerLength = '{CUSTOMIZER.Year}'.length;
    const effectiveLength = cleaned.length - (customizerCount * customizerLength);
    
    // Truncate if necessary
    if (effectiveLength > maxLength) {
      // Try to cut at the last space before maxLength
      const cut = cleaned.lastIndexOf(' ', maxLength + (customizerCount * customizerLength));
      cleaned = cleaned.slice(0, cut > 0 ? cut : maxLength + (customizerCount * customizerLength));
    }
  } else {
    // If no {CUSTOMIZER.Year}, just truncate normally
    if (cleaned.length > maxLength) {
      const cut = cleaned.lastIndexOf(' ', maxLength);
      cleaned = cleaned.slice(0, cut > 0 ? cut : maxLength);
    }
  }
  
  return cleaned;
}

type FieldInstructions = {
    [fieldName: string]: string[] // array of values per row
  }
  
  export function generateRowsUsinObjectTemplate(base: Record<string, string>, rowCount: number, instructions: FieldInstructions = {}): Record<string, string>[] {

    const rows: Record<string, string>[] = []
  
    for (let i = 0; i < rowCount; i++) {
      const row: Record<string, string> = {}
  
      for (const key in base) {
        row[key] = instructions[key]?.[i] ?? base[key]
      }
  
      rows.push(row)
    }
  
    return rows
}

export function extractHeadlinesAndDescriptions(
  raw: string, 
  baseTemplate: Record<string, string>, 
  hostname: string,
  constantContent: ConstantHeadersAndDescriptions
): any[] {
  const adTemplates = []
  
  const concepts = raw.split(/\*\*Ad Concept \d+:.*?\*\*/).filter(Boolean)
  for (const concept of concepts) {
    const lines = concept.split('\n').map(line => line.trim()).filter(line => /^\d+\.\s+/.test(line))
    
    // Extract and clean headlines 1-6 from GPT response
    const headlines = lines.slice(0, 6).map(line => {
      // Remove both the leading number and the trailing character count
      const headline = line
        .replace(/^\d+\.\s*/, '')      
        .replace(/\s*-\s*\d+\s*characters$/, '')  
        .replace(/\s*-\s*\d+$/, '');
      return cleanAdText(headline, 30); // Enforce 30 char limit
    });
    
    // Extract and clean descriptions 1-2 from GPT response
    const descriptions = lines.slice(15, 17).map(line => {
      // Remove both the leading number and the trailing character count
      const description = line
        .replace(/^\d+\.\s*/, '')
        .replace(/\s*-\s*\d+\s*characters$/, '')
        .replace(/\s*-\s*\d+$/, '');
      return cleanAdText(description, 90); // Enforce 90 char limit
    });
      
    // Clone base template
    const adTemplate = { ...baseTemplate }

    // Fill headlines 1-6 from GPT response
    for (let i = 0; i < headlines.length; i++) {
      adTemplate[`Headline ${i + 1}`] = headlines[i]
    }

    // Fill headlines 7-15 from constant content
    for (let i = 7; i <= 15; i++) {
      const value = constantContent.headlines[i - 7];
      if (!value) {
        console.warn(`[HEADLINE] Filling Headline ${i} with empty value! Index in constantContent.headlines: ${i - 7}`);
      }
      adTemplate[`Headline ${i}`] = cleanAdText(value || '', 30);
    }

    // Fill descriptions 1-2 from GPT response
    for (let i = 0; i < descriptions.length; i++) {
      adTemplate[`Description ${i + 1}`] = descriptions[i]
    }

    // Fill descriptions 3-4 from constant content
    for (let i = 3; i <= 4; i++) {
      const value = constantContent.descriptions[i - 3];
      if (!value) {
        console.warn(`[DESCRIPTION] Filling Description ${i} with empty value! Index in constantContent.descriptions: ${i - 3}`);
      }
      adTemplate[`Description ${i}`] = cleanAdText(value || '', 90);
    }

    // Add the Final URL using hostname
    if (hostname) {
      adTemplate['Final URL'] = hostname
    }
  
    adTemplates.push(adTemplate)
  }

  return adTemplates
}

// box A Tommy copy paste trick
  export function generateFullAddObject(adsArray, sourceData) {
    const finalAds = [];
  
    for (const ad of adsArray) {
      const baseAd = { ...ad };
      const duplicatedAd = { ...ad };
  
      const keyword = sourceData.industryKeyword[0];
      const adGroupName = `${keyword} - Exact`;
  
      // Original with | M
      baseAd['Campaign'] = `${keyword} | M`;
      baseAd['Ad Group'] = adGroupName;
  
      // Duplicate with | D
      duplicatedAd['Campaign'] = `${keyword} | D`;
      duplicatedAd['Ad Group'] = adGroupName;
  
      finalAds.push(baseAd, duplicatedAd);
    }
  
    return finalAds;
  }
  

  export function harvestSpecificContentFromFirstAd(adTemplates: Record<string, string>[]): ConstantHeadersAndDescriptions {
    // Check if we have ads to harvest from
    if (!adTemplates || adTemplates.length === 0) {
      return {
        headlines: [],
        descriptions: []
      };
    }
  
    const ad1 = adTemplates[0];
    const headlines: string[] = [];
    const descriptions: string[] = [];
  
    // Harvest headlines 7 to 15
    for (let i = 7; i <= 15; i++) {
      const headline = ad1[`Headline ${i}`];
      if (headline) {
        headlines.push(headline);
      }
    }
  
    // Harvest descriptions 2 to 3
    for (let i = 2; i <= 3; i++) {
      const description = ad1[`Description ${i}`];
      if (description) {
        descriptions.push(description);
      }
    }
  
    return {
      headlines,
      descriptions
    };
  }



  export async function exportToCsv(data: any[], filename: string, outputDir = 'exports') {
    if (!data || data.length === 0) throw new Error('No data to export')
  
    const headers = Object.keys(data[0])
    const csvRows = [headers.join(',')]
  
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header] ?? ''
        return `"${String(value).replace(/"/g, '""')}"`
      })
      csvRows.push(values.join(','))
    }
    return { key: filename,values: csvRows.join('\n') }
     
      
 
  }



  export function generateConstantHeadersAndDescriptions(raw: string, baseTemplate: Record<string, string>, hostname?: string): ConstantHeadersAndDescriptions {
    // Initialize empty arrays for headlines and descriptions
    const headlines: string[] = [];
    const descriptions: string[] = [];
    
    // Clean up the raw content to get only the lines with numbers
    const lines = raw.split('\n').map(line => line.trim()).filter(line => /^\d+\.\s+/.test(line));
    
    // Get all headlines (assuming first 15 lines are headlines)
    const allHeadlines = lines.slice(0, 15).map(line => 
      line.replace(/^\d+\.\s*/, '').replace(/\s*-\s*\d+\s*characters$/, '')
    );
    
    // Get all descriptions (assuming lines 16-19 are descriptions)
    const allDescriptions = lines.slice(15, 19).map(line => 
      line.replace(/^\d+\.\s*/, '').replace(/\s*-\s*\d+\s*characters$/, '')
    );
    
    // Extract only headlines 7-15 (indices 6-14)
    for (let i = 6; i < 15 && i < allHeadlines.length; i++) {
      headlines.push(allHeadlines[i]);
    }
    
    // Extract only descriptions 3-4 (indices 2-3)
    for (let i = 2; i < 4 && i < allDescriptions.length; i++) {
      descriptions.push(allDescriptions[i]);
    }
    
    return { headlines, descriptions };
  }



// recieves string that contains chunk of 4-6 campaign name + keywords , should extract from the string the campaign names and the relevant words per campaign
 
  let a = `
  'Let's start by processing the provided list of keywords. We'll remove duplicates, segment them into logical campaigns, and ensure all keywords are accounted for.


### Initial Keyword Count
The initial list contains 80 keywords.


### Remove Exact Duplicates
After removing duplicates (case-insensitive), the list is reduced to 74 unique keywords.


### Create Semantic Campaign Segments


Based on the provided keywords, I've identified the following campaign segments:


1. **Online Colleges and Universities**
2. **Cheapest and Affordable Options**
3. **Best and Top Options**
4. **Specific Degree Programs**
5. **Brand-Specific**
6. **Generic**


### Campaign Segments and Keywords


#### CAMPAIGN: Online Colleges and Universities
- online colleges
- online college courses
- online college degrees
- online school
- online college programs
- online universities accredited
- online university
- online degrees
- online associate degree
- online university programs
- online university texas
- online university maryland
- online university florida
- online universities in usa
- online community college
- college online


#### CAMPAIGN: Cheapest and Affordable Options
- cheapest online university
- cheapest bachelor degree
- cheap colleges
- what is the cheapest online university
- cheapest masters degree
- cheapest online school
- cheapest online tuition
- cheapest accredited online college
- cheapest online bachelor's degree
- cheapest online psychology degree
- cheapest online masters


#### CAMPAIGN: Best and Top Options
- online colleges best
- best online college programs
- best online accredited colleges
- what are the best online colleges
- best online universities
- best colleges online
- top online colleges
- best online school
- best online degrees
- best online bachelor degree programs


#### CAMPAIGN: Specific Degree Programs
- graphic design bachelor's degree online
- online graphic design degree
- civil engineering online degree
- online civil engineering
- online degree programs
- online creative writing degree
- creative writing degrees
- online digital photography degree
- online psychology degree
- psychology
- criminal psychology
- forensic psychology
- construction degrees online
- meteorology degree online
- political science degree
- online geology degree programs
- paralegal certificate online
- online lpn programs
- online cna classes
- software engineer
- online classes for adults
- associate's degree online
- masters in graphic design online
- best online business degree
- best interior design school online
- get a graphic design degree online
- graphic design programs online
- graphic design online courses


#### CAMPAIGN: Brand-Specific
- wgu
- snhu
- western governors university
- purdue global
- southern new hampshire university
- grand canyon university


#### CAMPAIGN: Generic
- how to become a lawyer
- how to become a psychologist
- nationally accredited online colleges
- self paced online colleges
- good online colleges
- good online universities
- the best online colleges
- law school
- law degree
- online bachelor degree programs
- school online


### Post Segmentation Keyword Count
The total number of keywords after segmentation is 74, matching the deduplicated count.


This segmentation ensures all keywords are logically grouped, with no overlaps or duplicates. If further adjustments are needed, please let me know!'

  `
  export function extractCampaignChunks(gptResponse: any): { name: string, words: string[] }[] {
    try {
       let lines = a
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('####') || line.startsWith('-'));
  
    lines = lines.slice(2, -1);
  
    const arr = JSON.stringify(lines).split('####');
  
    let finalArr = arr.map(chunk => {
      const [campaignPart, ...keywordParts] = chunk.split('","');
      const name = campaignPart.replace(/^.*CAMPAIGN:\s*/, '').replace(/"$/, '').trim();
      const words = keywordParts
        .map(w => w.replace(/^- /, '').replace(/"$/, '').trim())
        .filter(Boolean);
  
      return { name, words };
    });
    return finalArr;
    } catch (error) {
      console.log(error)
    }
   
  }
  export function parseAdGroupBlocks(content: string): { adGroup: string; keywords: string[] }[] {
    return content
      .trim()
      .split(/\n{2,}/) // split by double newlines
      .map(block => {
        const lines = block.trim().split('\n').map(l => l.trim()).filter(Boolean);
        const adGroup = lines.shift(); // first line is ad group name
        const keywords = lines;
        return adGroup ? { adGroup, keywords } : null; // skip if no adGroup name
      })
      .filter(Boolean); // remove nulls
  }

  export function generateDualCampaignRows(name: string, templateDefaults: Record<string, string>) {
    const campaignM = generateRowsUsinObjectTemplate(templateDefaults, 1, { Campaign: [`${name} | M`] })[0];
    const campaignD = generateRowsUsinObjectTemplate(templateDefaults, 1, { Campaign: [`${name} | D`] })[0];
    return [campaignM, campaignD];
  }


  