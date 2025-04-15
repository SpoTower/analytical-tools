import { promises as fs } from 'fs'
import * as path from 'path'

type FieldInstructions = {
    [fieldName: string]: string[] // array of values per row
  }
  
  export function generateRowsFromTemplate(base: Record<string, string>, rowCount: number, instructions: FieldInstructions = {}): Record<string, string>[] {

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

export function extractHeadlinesAndDescriptions(raw: string, baseTemplate: Record<string, string>): any[] {
    const adTemplates = []
  
    const concepts = raw.split(/\*\*Ad Concept \d+:.*?\*\*/).filter(Boolean)
    for (const concept of concepts) {

      const lines = concept.split('\n').map(line => line.trim()).filter(line => /^\d+\.\s+/.test(line)) // lines starting with numbers
      const headlines = lines.slice(0, 15).map(line =>line.replace(/^\d+\.\s*/, '').replace(/\s*-\s*\d+\s*characters$/, '')) // 0-15 lines 
      const descriptions = lines.slice(15, 19).map(line =>line.replace(/^\d+\.\s*/, '').replace(/\s*-\s*\d+\s*characters$/, '')) // 15-19 lines
        
      // Clone base template
      const adTemplate = { ...baseTemplate }
  
      // Fill headlines
      for (let i = 0; i < headlines.length; i++) {
        adTemplate[`Headline ${i + 1}`] = headlines[i]
      }
  
      // Fill descriptions
      for (let i = 0; i < descriptions.length; i++) {
        adTemplate[`Description ${i + 1}`] = descriptions[i]
      }
  
      adTemplates.push(adTemplate)
    }
  
    return adTemplates
  }


// box A Tommy copy paste trick
  export function prepareAdsWithCampaigns(adsArray, sourceData) {
    const finalAds = [];
  
    for (const ad of adsArray) {
      const baseAd = { ...ad };
      const duplicatedAd = { ...ad };
  
      const keyword = sourceData.industryKeyword[0];
      const adGroupName = `${keyword} - Exact`;
  
      // Original with | M
      baseAd['Campaign'] = `${keyword} | M`;
      baseAd['Ad Group'] = adGroupName;
  
      // Duplicate with | B
      duplicatedAd['Campaign'] = `${keyword} | B`;
      duplicatedAd['Ad Group'] = adGroupName;
  
      finalAds.push(baseAd, duplicatedAd);
    }
  
    return finalAds;
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
  
    const outputPath = path.resolve(__dirname, '..', outputDir)
    const fullFilePath = path.join(outputPath, filename)
  
    await fs.mkdir(outputPath, { recursive: true }) // Ensure folder exists
    await fs.writeFile(fullFilePath, csvRows.join('\n'), 'utf8')
  
    return fullFilePath
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
    const campaignM = generateRowsFromTemplate(templateDefaults, 1, { Campaign: [`${name} | M`] })[0];
    const campaignD = generateRowsFromTemplate(templateDefaults, 1, { Campaign: [`${name} | D`] })[0];
    return [campaignM, campaignD];
  }