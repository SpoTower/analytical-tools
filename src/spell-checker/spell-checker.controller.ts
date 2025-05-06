import { Controller, Get, Post, Body, Patch, Param, Delete, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { SpellCheckerService } from './spell-checker.service';
import { CreateSpellCheckerDto } from './dto/create-spell-checker.dto';
import { UpdateSpellCheckerDto } from './dto/update-spell-checker.dto';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';



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
 

  @Get('/lineupValidation')
  async lineupValidation(
    @Query('batchSize', new DefaultValuePipe(10), ParseIntPipe) batchSize: number,
    ) {
      try {
        return await this.spellCheckerService.lineupValidation( );
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
