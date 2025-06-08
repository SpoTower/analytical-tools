import { Controller, Get, Post, Body, Patch, Param, Delete, MethodNotAllowedException } from '@nestjs/common';
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
      const resourceNames = await this.bingService.createConversionGoals(conversionActions, domainId);
      if(conversionActions?.length != resourceNames?.length)  throw new Error('not all resource names were sucessfully created at bing')   
      await this.bingService.updateConversionNamesKidonTable(conversionActions,resourceNames,domainId);
      return { status: 'ok', count: resourceNames.length };
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
