import { Controller, Get, Post, Body, Patch, Param, Delete, MethodNotAllowedException, Query } from '@nestjs/common';
import { BingService } from './bing.service';
import { CreateBingDto } from './dto/create-bing.dto';
import { UpdateBingDto } from './dto/update-bing.dto';
import { logToCloudWatch } from 'src/logger';
 @Controller('bing')
export class BingController {
  constructor(private readonly bingService: BingService) {}

  @Post('/generateConversions')
  async generateConversions(@Body() body: any) {

    try {
    
      const { conversionActions, hostname, domainId } = body;
 
      const resourceNames = await this.bingService.createConversionGoals(conversionActions, domainId );
       return { status: 'ok', count: resourceNames.length };
    }catch(e){
      logToCloudWatch(e.message, 'ERROR', 'bing');
      return { status: 'error', count: '', message: e.message };
    }      
   }

   //obtaining bing urls from bing soap ads api. campaigns->ad groups->ads -> urls and saving to bing_landing_pages table
   @Get('/saveBingUrls')
   async saveBingUrls(@Query('domainId') domainId?: number) {
    try{
    const urls = await this.bingService.saveBingUrls(+domainId );
    return urls;
    }catch(e){
      logToCloudWatch(e.message, 'ERROR', 'bing');
      return { status: 'error', count: '', message: e.message };
    }
   }
  
   @Get('/getBingUrls')
   async getBingUrls(@Query('hostname') hostname?: string) {
    try{
    const urls = await this.bingService.getBingUrls(hostname );
    return urls;
    }catch(e){
      logToCloudWatch(e.message, 'ERROR', 'bing');
      return { status: 'error', count: '', message: e.message };
    }
   }

  @Get()
  findAll() {
    return this.bingService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.bingService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateBingDto: UpdateBingDto) {
    return this.bingService.update(+id, updateBingDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.bingService.remove(+id);
  }
}
