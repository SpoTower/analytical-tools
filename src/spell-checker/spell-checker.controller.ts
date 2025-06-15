import { Controller, Get, Post, Body, Patch, Param, Delete, Query, DefaultValuePipe, ParseIntPipe, ParseBoolPipe, Inject } from '@nestjs/common';
import { SpellCheckerService } from './spell-checker.service';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { logToCloudWatch } from 'src/logger';
import { ANALYTICS_CONNECTION } from 'src/knex/knex.module';
import { KIDON_CONNECTION } from 'src/knex/knex.module';
import { Knex } from 'knex';
import { GptService } from 'src/gpt/gpt.service';
import { BingService } from 'src/bing/bing.service';


@Controller('spell-checker')
export class SpellCheckerController {
 
  @Inject(ANALYTICS_CONNECTION) private readonly analyticsClient: Knex
    @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex

 
    constructor(
      private readonly spellCheckerService: SpellCheckerService, 
      private readonly bingService: BingService) {}

  @Post()
  create(@Body() createSpellCheckerDto: CreateSpellCheckerDto) {
    return this.spellCheckerService.create(createSpellCheckerDto);
  }

 
 // fetches domain and uses pupeteer to send requests to domain.paths
// checks whether there is a lineup on the page based on css class and id of lineup wrapper, and also that the status is 200 and the loading time less than 10 seconds
@Get('/webSitesChecks')
async webSitesChecks(
  @Query('hostname', ) hostname: string,
  @Query('isTest', new DefaultValuePipe(false), ParseBoolPipe) isTest?: boolean,
  @Query('url', new DefaultValuePipe(null)) url?: string
  ) {
    try {
      return await this.spellCheckerService.webSitesChecks(hostname, isTest, url );
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
    }
  }





// fetching data from invoca transactions report, iterates over them with pupeteer and searchinf if there is invoca tag in the dom and script sections
// iterate only over non-spotower urls
@Get('/invocaPartnersTagValidation')
async invocaPartnersTagValidation(
  @Query('hostname') hostname: string, 
  @Query('url') url:string, 
  @Query('isTest') isTest:boolean,
) {
  return this.spellCheckerService.invocaPartnersTagValidation(hostname, url, isTest);
}







  
  //fetching google ads via google api with axios. tests: misspelled words, outdated years, non capital letters
  @Get('/findGoogleAdsGrammaticalErrors')
  async GoogleAdsGrammaticalErrors(
    @Query('batchSize', new DefaultValuePipe(10), ParseIntPipe) batchSize: number,
    @Query('domainId' ) domainId?: number,
     @Query('sliceSize' ) sliceSize?: number
    ) {
    try {
       return await this.spellCheckerService.findAndFixGoogleAdsGrammaticalErrors(batchSize,  +domainId, +sliceSize   );
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
    }
  }

 // bq, fetching urls from landing_page_performance table, and checking if the base url is in the path url
  @Get('/urlValidation')
  async urlValidation() {
    try {
       return await this.spellCheckerService.urlValidation( );
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
    }
  }



// checks whether traffick from tracker visitors and BQ that defined as mobile only arrives to desktop only campaigns
  @Get('/mobileAndDesktopTrafficCongruenceValidation')
  async mobileAndDesktopTrafficCongruenceValidation(
    @Query('isTest', new DefaultValuePipe(false), ParseBoolPipe) isTest?: boolean
  ){
    try {
      return await this.spellCheckerService.mobileAndDesktopTrafficCongruenceValidation(isTest);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
    }
  }
  

 





 


 

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.spellCheckerService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSpellCheckerDto: UpdateSpellCheckerDto) {
    return this.spellCheckerService.update(+id, updateSpellCheckerDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.spellCheckerService.remove(+id);
  }

 
}
