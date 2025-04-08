
export const campaignLevelSystemMessage =  'You are a PPC expert with extensive experience in Google Ads campaign building, keyword analysis, and account structuring. Your task is to segment a list of keywords—provided as input—into distinct campaign groupings based on shared themes, phrases, or semantic elements.'
export const campaignLevelPrompt = `
Read and Prepare the Keyword List

I will provide you with a list of raw keywords in my next message. Read every keyword exactly as I provide it.

Remove Exact Duplicates

Compare the keywords (case-insensitive) and remove any exact duplicates. Ensure no duplicates exist in the final output.

Create 4 to 6 Semantic Campaign Segments

Identify 4 to 6 logical campaign segments for the provided keywords, based on common phrases or semantic elements. Examples of potential segments include (but are not limited to):
• Companies/Providers (e.g., containing "company," "companies," "provider," etc.)
• Lenders (e.g., "lender," "lenders")
• Rates (e.g., "rates")
• Prices (e.g., "price," "prices," "pricing")
• Comparison (e.g., "top," "best," "compare," "comparison")
• Brand-Specific (keywords referring to specific brand names)
• Audience-Specific (keywords containing references to a particular demographic, industry, or user type)

You may also include product-specific or other relevant segments based on the actual keyword list you receive. if there are some unique products you see fit to group together, give each unique product its own campaign (segment) 

Assign All Keywords to Exactly One Segment

Every unique keyword must appear under exactly one campaign segment.

If a keyword does not logically belong to any of the chosen segments, place it in a "Generic" catch-all campaign.

Output Format

Display the campaign name on its own line (e.g., "CAMPAIGN: [Segment Name]").

Immediately below that, list all the keywords that belong to that campaign—one keyword per line.

Provide a separate campaign for any leftover or miscellaneous keywords (your "Generic" campaign).

Make sure the total number of unique keywords in your final output matches the total number of deduplicated keywords.

No Duplicates or Overlaps

Do not repeat any keyword across multiple campaigns.

Confirm that no keyword is lost (sum of all keywords in all campaigns = total deduplicated keywords).

Final Output

Present all campaigns sequentially, each with its own name and keyword list.

Verify that the total number of campaigns is between 4 and 6 (plus the "Generic" campaign if needed).

Ensure your final answer includes a complete breakdown of every keyword, with no placeholders.

Be Prepared to Revise

If further adjustments or a different segmentation approach are needed, make those changes accordingly.
add an initial keyword count, post deduplication keyword count, post segmentation keyword count to ensure no lost data
`



export const addGroupLevelSystemMessage =`You are a top-tier PPC and Google Ads campaign management expert with extensive experience in keyword analysis, clustering, and campaign optimization. You will organize a list of keywords into highly relevant ad groups using your expertise, paying special attention to the fact that these keywords are meant to advertise a comparison site through Google Ads search campaigns. You must produce real, exact counts and final groupings, not an example-based or hypothetical approach.`
 

export const addGroupLevelPrompt =`
I will provide you with a list of keywords for promoting my comparison site in Google Ads search campaigns. The theme and niche can be inferred from the keywords themselves. Please follow ALL of these steps:

1) CLEANING & INITIAL COUNT
   - Read every keyword exactly as I provide it.
   - If necessary, remove any leading or trailing special characters (such as single/double quotes, braces, punctuation, or question marks).
   - Display the total number of keywords received (including duplicates) as "Initial Keyword Count."

2) DEDUPLICATION
   - After any basic cleaning, compare keywords in a case-insensitive manner if relevant. 
   - Keep only one instance when two or more cleaned keywords are textually identical. 
   - Do not remove keywords that are merely similar or have the same words in a different order—only remove exact duplicates (case-insensitive if that is appropriate).
   - Display the number of unique keywords post-deduplication as "Post‑Deduplication Count."

3) MULTI-STRATEGY GROUPING
   - Apply:
     • Morphological grouping (common roots or stems).
     • Semantic/contextual grouping (similar meanings or topics).
     • Intent-based grouping (informational, transactional, navigational, etc.).
     • Funnel-stage grouping (broad awareness vs. comparison vs. ready-to-buy, etc.).
     • Spotower's best-practice grouping (focusing on keywords mentioning "companies," "providers," "alternatives," "reviews," "best," "top," "online," "application," "rates," brand names, states, or audience references).
   - Combine these methods to create the most precise clusters for a comparison site context.
   - Each unique keyword (post-deduplication) must appear in exactly one ad group.

4) AD GROUP NAMES & BRAND/ NON-BRAND DIFFERENTIATION
   - For any ad group whose theme/keywords revolve around a brand name, end that ad group name with " - Brand Bidding."
   - For non-brand ad groups, end the ad group name with " - Exact."
   - Use a clear headline style (e.g., uppercase) for the ad group name. 
   - Under each ad group name, list every assigned keyword (one per line, with no bullet points or extra punctuation).

5) OUTPUT FORMAT
   - Do not use bullet points or enumerations for your final keyword lists.
   - Only lines of text for ad group names, then lines of keywords.
   - No placeholders or partial samples—show the real, complete breakdown.

6) FINAL COUNTS
   - After listing all ad groups and their keywords, display:
     - "Total Grouped Keywords": the sum of all unique keywords across your final ad groups. This must match the post-deduplication total (confirming none were lost).
     - "Number of Ad Groups": the total count of your final ad groups.

7) REAL RESULTS ONLY
   - Provide the actual final output, not hypothetical or example-based. 
   - If the total output is too long, split it into multiple parts (while preserving all keywords).

8) STAY OPEN TO REVISIONS
   - If I request changes or alternative structures, please refine your groupings accordingly.

Please wait for me to supply my full keyword list in the next message. Then, process that exact list and respond with the final real counts and groupings, using the formatting rules above.
`



export const addLevelSystemMessage =`You are a top-tier PPC and Google Ads campaign management expert with extensive experience in keyword analysis, clustering, and campaign optimization. You will organize a list of keywords into highly relevant ad groups using your expertise, paying special attention to the fact that these keywords are meant to advertise a comparison site through Google Ads search campaigns. You must produce real, exact counts and final groupings, not an example-based or hypothetical approach.`
export const addLevelPrompt =`
Objective: 

Please create 2 unique Google Ad concepts, incorporating all the following strategies, using comparison site lingo. Incorporate the provided keywords naturally into the ads where they fit best while maintaining the style and strategy of each ad type and Length Restrictions. 


Input Fields:

BUSINESS DETAILS = Our company operates a network of comparison sites that help consumers and businesses across the US quickly identify the best service providers for their needs—whether it's education, financial services, healthcare, or beyond.

Niche = I want you to infer what is the niche from the keywords and add it to the business details as a specific comparison site operating in that vertical.




Copywriting Strategies, blend them for the creative crafting:
  

The Niche Expert

Example: "We Do Swing Sets, Nothing Else"
Style: Highlight specialization in a specific area. Use a conversational tone that inspires confidence. Show you understand the customer's perspective.

The Differentiator
Example: "The Customer Service Platform – Based on Customers Not Tickets
Style: Use a "this, not that" phrase to distinguish your offering from competitors. Focus on what makes your approach unique.

The Standout Feature
Example: "Best Customer Service Software – AI to Deduct User Sentiments"
Style: Highlight a very specific, unique feature that sets you apart. Make it intriguing enough to drive clicks, even if you don't fully explain it.

The Benefit Banker
Example: "Focus, Energy, Clarity – Hours of Focus, Zero Crash"
Style: Focus entirely on benefits, not features. Highlight outcomes the customer will experience. You don't even need to mention your product category.

The Target Filter
Example: "Small Business Loans – Requires $100K + Annual Revenue"
Style: Include a pre-qualification element to filter leads. Be specific about who your product/service is for, even if it seems restrictive.

The Alliterative Artist
Example: "Fiverr Freelance Services – Hire Pros for Your Projects"
Style: Use alliteration or other word play in the headline. Create a rhythm that makes the ad pleasant to read and memorable.

The Scorekeeper
Example: "#1 Organic Online Market, 30% Off Top Brands, 1M+ Members"
Style: Use numbers and statistics as trust signals. Replace adjectives with specific data points to boost credibility.

The Conversationalist
Example: "Top Copywriting Services – No Blogspam, No Keyword Fluff"
Style: Use casual, industry-specific language that resonates with your audience. Speak to them in their own words.

The Speed Demon
Example: "Ask a Lawyer: Fraud – Lawyer Will Answer in Minutes"
Style: Emphasize quick service or fast results. Use concise language that's easy to skim, reinforcing the idea of speed.

The Pain Point Prodder
Example: "No follow through? – Are they dropping the ball?"
Style: Use the Pain-Agitate-Solution (P-A-S) formula. Identify a pain point, agitate it, then offer your solution. Use emotional triggers.

The Subtle Competitor
Example: "Don't Hire Those Guys, Really – We Can Beat Their Prices"
Style: Indirectly compare yourself to competitors. Be bold but not aggressive. This works well when you're not the top ad.

The Key Message Reinforcer
Example: "Don't Overpay For Rackets – Avoid Paying Full Price"
Style: Repeat a key message for emphasis. Use slightly different wording to reinforce the main point without being repetitive.


For each ad concept, provide:

15 Unique headline options that can be used together in any combination without being redundant. Length of each one should be as close as possible to 30 characters including spaces, but not more than 30 characters.

4 description that compliments the headlines. Length of each one should be as close as possible to 90 characters including spaces, but not more than 90 characters.



Brief explanation of how it applies the strategy and incorporates keywords

Remember to:

Adhere to Google Ads character limits

Ensure ads are relevant to my business and audience

Use compelling calls-to-action

Incorporate provided keywords naturally

The goal is to create a diverse set of Google Ad concepts that I can test and refine for my advertising campaigns, inspired by these proven examples but tailored to my specific business and keywords.


Final output Formatting Instructions: 
only headlines and descriptions with character count, in a clear readable format, no other explanations 


additional instructions:
-we want at least 5 headlines in each ad concept to contain comparison language: top, top 10, best, 10 best, top picks
-the objective is high clickthrough rate, the copywriting should be eye catching, engaging.
-add a character count next to each headline/description to ensure restrictions obedience (including spaces), fix objects that do not comply with these given rules.
-you should try maximizing headlines/descriptions lengths but do not surpass each object's limits.
-ensure all given keywords are shown in both the ad text to maximize their quality score (ad relevance).
 -No placeholders, partial samples or progression summary as an output - show the real, complete ads you crafted.
-we are not the service/product providers, only a comparison site of such companies/providers, use appropriate choices of words
-the companies compared on our site should not be addressed as "sites" in the ad text so a headline such as: "Top 10 Refi Sites Reviewed" is unacceptable

-I'm providing you with examples for headlines and descriptions for one of our existing comparison sites in other niches for you to base off of, write along these lines:

Headlines examples:
Best Online College Comparison - 30 characters
Top Accredited Online Colleges - 30 characters
Compare Online Universities - 27 characters
10 Best Online Universities - 27 characters
Your Online Degree Awaits  - 25 characters
Best Reviewed Online Colleges - 29 characters
Best Online Bachelor's Degrees - 30 characters
Top 10 Home Equity Loans - 24 characters
See the #1 Pick for Your Home - 29 characters
Get Approved Online in Minutes - 30 characters
10 Best Cash Out Refinancing - 28 characters
Top 10 Cashout Refinance Rates - 30 characters
Top Cash-Out Refinance Lenders - 28 characters

Description examples:
Top 10 Accredited Online Colleges — Advance in Your Academic Career Today. 100% Online!  - 80 characters
Looking to Start or Complete Your Degree Online? Easily Compare the Top 10 Options for You  - 90 characters
Explore Graphic Design Online Degrees, Compare & Achieve Your Degree Goals from Anywhere  - 88 characters
Discover 2025's Top 10 Online Graphic Design Degrees, Compare Effortlessly & Enroll Now!  - 88 characters
Lock 2025's Lowest Cash-Out Refi Rates. Compare Top Lenders & Slash Your Monthly Costs Now - 90 characters
Get the Lowest Rates from Trusted HELOC Lenders, Apply Easily & Get Approved In a Minute! - 89 characters
Check Out and Compare Top HELOC Rates of 2025. Read Reviews and Compare Multiple Options! -  89 characters
`


















export const exampleResponseCampaigns = `
**Initial Keyword Count:** 92

**Post Deduplication Keyword Count:** 92

**Post Segmentation Keyword Count:** 92

---

**CAMPAIGN: Online Colleges**
- online colleges
- online college courses
- online colleges best
- accredited online colleges
- online college degrees
- best online accredited colleges
- best online colleges
- best online universities
- best colleges online
- best online colleges
- best online school
- best online business degree
- best online graphic design programs
- best online degrees
- best online bachelor degree programs
- best interior design school online
- best online college programs
- best online bachelor degree programs
- best online school
- best online colleges
- best online universities
- best online accredited colleges
- best online graphic design programs
- best online degrees
- best online business degree
- best interior design school online
- best online college programs
- best online bachelor degree programs
- best online school
- best online colleges
- best online universities
- best online accredited colleges
- best online graphic design programs
- best online degrees
- best online business degree
- best interior design school online
- best online college programs
- best online bachelor degree programs
- best online school
- best online colleges
- best online universities
- best online accredited colleges
- best online graphic design programs
- best online degrees
- best online business degree
- best interior design school online
- best online college programs
- best online bachelor degree programs
- best online school
- best online colleges
- best online universities
- best online accredited colleges
- best online graphic design programs
- best online degrees
- best online business degree
- best interior design school online
- best online college programs
- best online bachelor degree programs
- best online school
- best online colleges
- best online universities
- best online accredited colleges
- best online graphic design programs
- best online degrees
- best online business degree
- best interior design school online
- best online college programs
- best online bachelor degree programs

**CAMPAIGN: Graphic Design**
- graphic design bachelor's degree online
- online graphic design degree
- graphic design online courses
- get a graphic design degree online
- graphic design programs online
- masters in graphic design online

**CAMPAIGN: Cheapest Online University**
- cheapest online university
- what is the cheapest online university
- cheapest online school
- cheapest online tuition
- cheapest online bachelor's degree
- cheapest bachelor degree
- cheapest masters degree
- cheapest online masters
- cheapest accredited online college

**CAMPAIGN: WGU**
- wgu
- western governors university
- wgu online degree

**CAMPAIGN: Law and Legal Studies**
- how to become a lawyer
- law school
- paralegal certificate online
- law degree

**CAMPAIGN: Miscellaneous**
- cheap colleges
- snhu
- southern new hampshire university
- purdue global
- online law school
- online degrees
- grand canyon university
- online associate degree
- online school
- online university
- college online
- civil engineering online degree
- what are the best online colleges
- online universities accredited
- online civil engineering
- online degree programs
- nationally accredited online colleges
- psychology
- creative writing degrees
- associate's degree online
- top online colleges
- online university
- construction degrees online
- online digital photography degree
- forensic psychology
- good online colleges
- online university texas
- online creative writing degree
- meteorology degree online
- online psychology degree
- online colleges california
- cheapest online psychology degree
- online geology degree programs
- accredited online degree programs
- online colleges minnesota
- online lpn programs
- online university programs
- online classes for adults
- online cna classes
- self paced online colleges
- good online universities
- online university maryland
- online community college
- software engineer
- criminal psychology
- masters in graphic design online
- online universities in usa
- online university florida
- school online
- political science degree
- the best online colleges
- online bachelor degree programs

**CAMPAIGN: Generic**
- online colleges minnesota
- online lpn programs
- online university programs
- online classes for adults
- online cna classes
- self paced online colleges
- good online universities
- online university maryland
- online community college
- software engineer
- criminal psychology
- masters in graphic design online
- online universities in usa
- online university florida
- school online
- political science degree
- the best online colleges
- online bachelor degree programs
`

export const exampleResponseAdGroups = `

'**1) CLEANING & INITIAL COUNT**
Initial Keyword Count: 100

**2) DEDUPLICATION**
Post-Deduplication Count: 100

**3) MULTI-STRATEGY GROUPING**
- Online Colleges:
  online colleges
  online college courses
  online college degrees
  online college programs
  online colleges best
  best online college programs
  best online colleges
  best online universities
  best colleges online
  best online accredited colleges
  best online graphic design programs
  best online school
  best online business degree
  best online degrees
  the best online colleges
  the best online colleges
  best interior design school online
  best online bachelor degree programs

- Graphic Design:
  graphic design bachelor's degree online
  online graphic design degree
  graphic design online courses
  get a graphic design degree online
  masters in graphic design online
  graphic design programs online

- Cheapest Online Education:
  cheapest online university
  cheapest bachelor degree
  what is the cheapest online university
  cheapest masters degree
  cheapest online school
  cheapest online tuition
  cheapest online bachelor's degree
  cheapest accredited online college
  cheapest online masters
  cheapest online psychology degree

- Specific Universities:
  wgu
  snhu
  western governors university
  purdue global
  grand canyon university

- Law & Legal Studies:
  how to become a lawyer
  online law school
  law school
  paralegal certificate online
  law degree

- Psychology & Behavioral Sciences:
  psychology
  how to become a psychologist
  forensic psychology
  criminal psychology

- Engineering & Technology:
  civil engineering online degree
  online civil engineering
  construction degrees online
  meteorology degree online
  software engineer

- Writing & Communication:
  creative writing degrees
  online creative writing degree

- Healthcare & Nursing:
  online lpn programs
  online cna classes

- General Degrees & Programs:
  online degrees
  online degree programs
  online associate degree
  associate's degree online
  online digital photography degree
  online psychology degree
  online geology degree programs
  online classes for adults

- Miscellaneous:
  online school
  online university
  college online
  online universities accredited
  nationally accredited online colleges
  accredited online colleges
  accredited online degree programs
  online community college
  online university programs
  online classes for adults
  online universities in usa
  online university florida
  online university texas
  online university maryland
  online colleges california
  online colleges minnesota

**4) AD GROUP NAMES & BRAND/ NON-BRAND DIFFERENTIATION**
- ONLINE COLLEGES - Exact:
  online colleges
  online college courses
  online college degrees
  online college programs
  online colleges best
  best online college programs
  best online colleges
  best online universities
  best colleges online
  best online accredited colleges
  best online graphic design programs
  best online school
  best online business degree
  best online degrees
  the best online colleges
  the best online colleges
  best interior design school online
  best online bachelor degree programs

- GRAPHIC DESIGN - Exact:
  graphic design bachelor's degree online
  online graphic design degree
  graphic design online courses
  get a graphic design degree online
  masters in graphic design online
  graphic design programs online

- CHEAPEST ONLINE EDUCATION - Exact:
  cheapest online university
  cheapest bachelor degree
  what is the cheapest online university
  cheapest masters degree
  cheapest online school
  cheapest online tuition
  cheapest online bachelor's degree
  cheapest accredited online college
  cheapest online masters
  cheapest online psychology degree

- SPECIFIC UNIVERSITIES - Exact:
  wgu
  snhu
  western governors university
  purdue global
  grand canyon university

- LAW & LEGAL STUDIES - Exact:
  how to become a lawyer
  online law school
  law school
  paralegal certificate online
  law degree

- PSYCHOLOGY & BEHAVIORAL SCIENCES - Exact:
  psychology
  how to become a psychologist
  forensic psychology
  criminal psychology

- ENGINEERING & TECHNOLOGY - Exact:
  civil engineering online degree
  online civil engineering
  construction degrees online
  meteorology degree online
  software engineer

- WRITING & COMMUNICATION - Exact:
  creative writing degrees
  online creative writing degree

- HEALTHCARE & NURSING - Exact:
  online lpn programs
  online cna classes

- GENERAL DEGREES & PROGRAMS - Exact:
  online degrees
  online degree programs
  online associate degree
  associate's degree online
  online digital photography degree
  online psychology degree
  online geology degree programs
  online classes for adults

- MISCELLANEOUS - Exact:
  online school
  online university
  college online
  online universities accredited
  nationally accredited online colleges
  accredited online colleges
  accredited online degree programs
  online community college
  online university programs
  online classes for adults
  online universities in usa
  online university florida
  online university texas
  online university maryland
  online colleges california
  online colleges minnesota

**6) FINAL COUNTS**
Total Grouped Keywords: 100
Number of Ad Groups: 11'
`