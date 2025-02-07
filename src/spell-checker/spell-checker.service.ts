import { Injectable,Logger } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
import OpenAI from 'openai';
import axios from 'axios';
import {queryGoogleAds,filterOutTextlessAds} from './utils';
import {fixingGrammErrorsPrompt2 } from './consts';
import { KnexService } from 'src/knex/knex.service';
 import { GlobalStateService } from 'src/globalState/global-state.service';
const logger = new Logger('analytical-tools.spellchecker');





@Injectable()
export class SpellCheckerService {

  constructor(
    private readonly knexService: KnexService,
    private readonly globalState: GlobalStateService
    ) {}

  async findAndFixGoogleAdsGrammaticalErrors(domainId?: number) {
    let state
 
    state =   this.globalState.getAllState();
 
    

   try {
    const openai = new OpenAI({apiKey: state.gptKey,  });
      
    for (const domain of state.domains) {
      logger.log(`processing domain ${domain.id}`);
      if (!domain.googleAdsId) continue;
      const adds = await queryGoogleAds(domain, state.companies, state.allTokens );
      if ((adds && adds.length == 0) || !adds) continue;
      const textfullAds = filterOutTextlessAds(adds);
      if ((textfullAds && textfullAds.length == 0) || !textfullAds) continue;

      const extractedAds = textfullAds.map((t) => ({
          id: parseInt(t.changeEvent.changeResourceName.split('/').pop(), 10), // Extract Ad ID from resource name
          resourceName: t.changeEvent.changeResourceName, // Use correct resource name
          headlines: t.changeEvent.newResource?.ad?.responsiveSearchAd?.headlines || [], // Get new headlines if available, fallback to old
          descriptions: t.changeEvent.newResource?.ad?.responsiveSearchAd?.descriptions || [], // Get new descriptions if available, fallback to old
          changeDateTime: t.changeEvent.changeDateTime, // When the change happened
          resourceChangeOperation: t.changeEvent.resourceChangeOperation, // Type of change (CREATE, UPDATE, REMOVE)
          changedFields: t.changeEvent.changedFields.split(','), // List of changed fields
      }));
      const spellcheckIgnoreList = ['CUSTOMIZER'];

      const response = await openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
              { role: 'system', content: fixingGrammErrorsPrompt2(spellcheckIgnoreList) },
              {
                  role: 'user',
                  content: `objectId: ${extractedAds[0].id},
               headlines: ${JSON.stringify(extractedAds[0].headlines.map((t) => t.text))}
                descriptions: ${JSON.stringify(extractedAds[0].descriptions.map((t) => t.text))}`,
              },
          ],
          max_tokens: 4000,
          temperature: 0.7,
      });
      //response.choices[0].message.content
      console.log(domain.id + ' ' + response.choices[0].message.content);
      return response.choices[0].message.content || 'no errors found';
  }


      } catch (error) {
        logger.error(error.message);
        
      }

    

  
 
  }







  create(createSpellCheckerDto: CreateSpellCheckerDto) {
    return 'This action adds a new spellChecker';
  }

 

  findOne(id: number) {
    return `This action returns a #${id} spellChecker`;
  }

  update(id: number, updateSpellCheckerDto: UpdateSpellCheckerDto) {
    return `This action updates a #${id} spellChecker`;
  }

  remove(id: number) {
    return `This action removes a #${id} spellChecker`;
  }
}
