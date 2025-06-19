import { Controller, Get, Post, Body, Patch, Param, Delete, Query, DefaultValuePipe, ParseBoolPipe } from '@nestjs/common';
import { FrontEndService } from './front-end.service';
import { CreateFrontEndDto } from './dto/create-front-end.dto';
import { UpdateFrontEndDto } from './dto/update-front-end.dto';
import { logToCloudWatch } from 'src/logger';
import { SpellCheckerService } from 'src/spell-checker/spell-checker.service';
import { BingService } from 'src/bing/bing.service';
@Controller('front-end')
export class FrontEndController {
  constructor(
    private readonly frontEndService: FrontEndService,
    private readonly spellCheckerService: SpellCheckerService,
    private readonly bingService: BingService
  ) {}








    // used by front end team to get active urls from google ads
    @Get('/googleActiveUrls')
    async activeUrls(
      @Query('hostname') hostname?: string,
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
    @Get('/bingActiveUrls')
    async bingBasedActiveUrls(
      @Query('hostname') hostname: string,
      @Query('originOnly', new DefaultValuePipe(false), ParseBoolPipe) originOnly?: boolean

     ) {
      const urls = await this.bingService.getBingUrls(hostname, originOnly);
      return urls;
    }
    












  @Post()
  create(@Body() createFrontEndDto: CreateFrontEndDto) {
    return this.frontEndService.create(createFrontEndDto);
  }

  @Get()
  findAll() {
    return this.frontEndService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.frontEndService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateFrontEndDto: UpdateFrontEndDto) {
    return this.frontEndService.update(+id, updateFrontEndDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.frontEndService.remove(+id);
  }
}
