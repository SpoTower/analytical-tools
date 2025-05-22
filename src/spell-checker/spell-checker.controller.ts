import { Controller, Get, Post, Body, Patch, Param, Delete, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { SpellCheckerService } from './spell-checker.service';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { logToCloudWatch } from 'src/logger';



@Controller('spell-checker')
export class SpellCheckerController {
  constructor(private readonly spellCheckerService: SpellCheckerService) {}

  @Post()
  create(@Body() createSpellCheckerDto: CreateSpellCheckerDto) {
    return this.spellCheckerService.create(createSpellCheckerDto);
  }


 

  @Get('/findGoogleAdsGrammaticalErrors')
  async GoogleAdsGrammaticalErrors(
    @Query('batchSize', new DefaultValuePipe(10), ParseIntPipe) batchSize: number,
    @Query('domainId' ) domainId?: number,
     @Query('sliceSize' ) sliceSize?: number
    ) {
    try {
       return await this.spellCheckerService.findAndFixGoogleAdsGrammaticalErrors(batchSize,+domainId, +sliceSize);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
    }
  }

 

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

   
  @Get('/findWebsitesGrammaticalErrors')
  async WebsitesGrammaticalErrors(
    @Query('domainId' ) domainId?: number,
    @Query('batchSize', new DefaultValuePipe(1), ParseIntPipe) batchSize?: number  
    ) {
    try {
       return await this.spellCheckerService.findAndFixWebsitesGrammaticalErrors(+domainId,batchSize);
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
    }
  }
 
// checks whether there is a lineup on the page based on css class and id of lineup wrapper, and also that the status is 200 and the loading time less than 10 seconds
  @Get('/lineupValidation')
  async lineupValidation(
    @Query('hostname', ) hostname: string,
    ) {
      try {
        return await this.spellCheckerService.lineupValidation(hostname );
      } catch (error) {
        if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
          throw error;
        }
      }
    }
    // used by front end team to get active urls from google ads
    @Get('/activeUrls')
    async activeUrls(
      @Query('hostname', ) hostname: string,
      ) {
        try {
          const urls = await this.spellCheckerService.activeUrls(hostname );
          return urls;
        } catch (error) {
          logToCloudWatch(`❌ Error fetching Google Ads for domain ${hostname}: ${error.message}`, "ERROR");
          return [];
        }
      }



// checks whether traffick from tracker visitors that defined as mobile only arrives to desktop only campaigns
  @Get('/mobileAndDesktopTrafficCongruenceValidation')
  async mobileAndDesktopTrafficCongruenceValidation(){
    try {
      return await this.spellCheckerService.mobileAndDesktopTrafficCongruenceValidation();
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
    }
  }
  
  @Get('/testLongWait')
  async testLongWait() {
    for (let i = 1; i <= 200; i++) {
      logToCloudWatch(`Waiting... second ${i}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    logToCloudWatch('Done waiting 200 seconds!');
    return { message: 'Waited 200 seconds, check logs for progress.' };
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
