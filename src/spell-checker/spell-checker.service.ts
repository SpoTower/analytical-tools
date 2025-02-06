import { Injectable } from '@nestjs/common';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
import OpenAI from 'openai';
import {convertToCamelCase} from '../../../kidon/src/utils/generalUtils';

@Injectable()
export class SpellCheckerService {


  async findAndFixGoogleAdsGrammaticalErrors(domainId?: number) {

    let a = convertToCamelCase('a_b_c_d');
    return `This action returns all spellChecker`;
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
