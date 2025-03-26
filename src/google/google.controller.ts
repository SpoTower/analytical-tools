import { Controller, Get, Post, Body, Patch, Param, Delete, UploadedFile, UseInterceptors, Logger } from '@nestjs/common';
import { GoogleService } from './google.service';
import { CreateGoogleDto } from './dto/create-google.dto';
import { UpdateGoogleDto } from './dto/update-google.dto';
 import { FileInterceptor } from '@nestjs/platform-express';
 import {conversionActions} from './interfaces'
 const logger = new Logger('google-service');

@Controller('google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}

  @Post('upload')
  async upload(@Body() body: { conversionActions: conversionActions[], hostname: string, domainId: number }) {
    try {
    const { conversionActions, hostname, domainId  } = body;
    logger.log(' Entering upload endpoint. Parsed rows:', conversionActions, 'Hostname:',  hostname);
  
    const creationResult = await this.googleService.createConversionActions(conversionActions,  hostname);
    await this.googleService.updateConversionNamesKidonTable(conversionActions,creationResult, domainId);
    return { status: 'ok', count: conversionActions.length };
    } catch (error) {
      return { status: 'error', count: '', message: error.message };
    }
 
  }
 

  @Get()
  findAll() {
    return this.googleService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.googleService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGoogleDto: UpdateGoogleDto) {
    return this.googleService.update(+id, updateGoogleDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.googleService.remove(+id);
  }
}
