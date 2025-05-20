import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { BingService } from './bing.service';
import { CreateBingDto } from './dto/create-bing.dto';
import { UpdateBingDto } from './dto/update-bing.dto';

@Controller('bing')
export class BingController {
  constructor(private readonly bingService: BingService) {}

  @Post('/generateConversions')
  async generateConversions(@Body() body: any) {
    const { conversionActions, hostname, domainId } = body;
    this.bingService.createConversionGoals(conversionActions, hostname, domainId);
  
 console.log(conversionActions, hostname, domainId)
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
