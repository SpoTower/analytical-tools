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



@Controller('spell-checker')
export class SpellCheckerController {
  @Inject(ANALYTICS_CONNECTION) private readonly analyticsClient: Knex
    @Inject(KIDON_CONNECTION) private readonly kidonClient: Knex
 
    constructor(private readonly spellCheckerService: SpellCheckerService) {}

  @Post()
  create(@Body() createSpellCheckerDto: CreateSpellCheckerDto) {
    return this.spellCheckerService.create(createSpellCheckerDto);
  }

// iterating over domains.paths and sending requests via axios, processing data with cheerio,  checking errors in text and outdates years
  @Get('/findWebsitesGrammaticalErrors')
  async WebsitesGrammaticalErrors(
    @Query('domainId' ) domainId?: number,
    @Query('isTest', new DefaultValuePipe(false), ParseBoolPipe) isTest?: boolean,
    @Query('url', new DefaultValuePipe(null)) url?: string
     
    ) {
    try {
       return await this.spellCheckerService.findAndFixWebsitesGrammaticalErrors(+domainId,  isTest, url);
    } catch (error) {
      logToCloudWatch(`❌ Error in findWebsitesGrammaticalErrors: ${error.message}, ${JSON.stringify(error)} `, "ERROR", 'spell-checker');
      return { message: 'Error in findWebsitesGrammaticalErrors' };
    }
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

   
 

 // fetches domain and uses pupeteer to send requests to domain.paths
// checks whether there is a lineup on the page based on css class and id of lineup wrapper, and also that the status is 200 and the loading time less than 10 seconds
  @Get('/lineupValidation')
  async lineupValidation(
    @Query('hostname', ) hostname: string,
    @Query('isTest', new DefaultValuePipe(false), ParseBoolPipe) isTest?: boolean,
    @Query('url', new DefaultValuePipe(null)) url?: string
    ) {
      try {
        return await this.spellCheckerService.lineupValidation(hostname, isTest, url );
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
  


// fetching data from invoca transactions repor, iterates over them with pupeteer and searchinf if there is invoca tag in the dom and script sections
// iterate only over non-spotower urls
  @Get('/invocaLineupValidation')
  async invocaLineupValidation(
    @Query('hostname') hostname: string, 
    @Query('url') url:string, 
    @Query('isTest') isTest:boolean,
  ) {
    return this.spellCheckerService.invocaLineupValidation(hostname, url, isTest);
  }





    // used by front end team to get active urls from google ads
    @Get('/googleBasedActiveUrls')
    async activeUrls(
      @Query('hostname') hostname: string,
      @Query('originOnly', new DefaultValuePipe(false), ParseBoolPipe) originOnly?: boolean
    ) {
      try {
        const urls = await this.spellCheckerService.activeUrls(hostname, originOnly);
        return urls;
      } catch (error) {
        logToCloudWatch(`❌ Error fetching Google Ads for domain ${hostname}: ${error.message}`, "ERROR");
        return [];
      }
    }
    

    @Get('/test')
    async testLongWait() {
      try {
       let atConfig = await this.analyticsClient('at-configuration').select('*') ;
        logToCloudWatch(`🔄 atConfig: ${JSON.stringify(atConfig)} `, "INFO", 'spell-checker');

       return { message: 'Waited 200 seconds, check logs for progress.' };
    } catch (error) {
      logToCloudWatch(`❌ Error in testLongWait: ${error.message}, ${JSON.stringify(error)} `, "ERROR", 'spell-checker');
      return { message: 'Error in testLongWait' };
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
