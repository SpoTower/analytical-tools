import { Controller, Get, Post, Body, Patch, Param, Delete, UploadedFile, UseInterceptors, Logger } from '@nestjs/common';
import { GoogleService } from './google.service';
import { CreateGoogleDto } from './dto/create-google.dto';
import { UpdateGoogleDto } from './dto/update-google.dto';
 import { FileInterceptor } from '@nestjs/platform-express';
 import {conversionActions,googleAdsSourceData} from './interfaces'
 const logger = new Logger('google-service');
 import { logToCloudWatch }  from 'src/logger';
 import { v4 as uuidv4 } from 'uuid';

@Controller('google')
export class GoogleController {
  constructor(private readonly googleService: GoogleService) {}
    generateAdsTaskMap = new Map<string, { status: string, result?: any, error?: string }>();

  //creating conversion names
  @Post('generateConversions')
  async upload(@Body() body: { conversionActions: conversionActions[], hostname: string, domainId: number }) {
    try {
    const { conversionActions, hostname, domainId  } = body;
    logToCloudWatch(` Entering upload endpoint. Parsed rows:, ${conversionActions.map((ca)=>JSON.stringify(ca))}, Hostname:,  ${hostname}`,  'INFO', 'UPLOAD_CONVERSIONS' );
   
  
    const creationResult = await this.googleService.createConversionActions(conversionActions,  hostname);
    const res = await this.googleService.updateConversionNamesKidonTable(conversionActions,creationResult, domainId);
    return { status: 'ok', count: conversionActions.length };
    } catch (error) {
      return { status: 'error', count: '', message: error.message };
    }
  }
  //
 
  //generating ads using gpt
  @Post('generateAds')
  async generateAds(@Body() body: { sourceData: googleAdsSourceData }) {
    logToCloudWatch('Entering generateAds endpoint. ', 'INFO', 'google');
    const { sourceData } = body;
    const taskId = uuidv4();
  
    this.generateAdsTaskMap.set(taskId, { status: 'processing' });
  
    // Run in background without blocking the HTTP response
    (async () => {
      const CLEANUP_TIMEOUT = 3 * 60 * 1000; // 5 minutes

      try {
        const result = await this.googleService.generateAds(sourceData);
        logToCloudWatch(`Ads generated successfully for task ${taskId}.`, 'INFO', 'google');
        this.generateAdsTaskMap.set(taskId, { status: 'done', result });
        setTimeout(() => {
          this.generateAdsTaskMap.delete(taskId);
        }, CLEANUP_TIMEOUT);
      } catch (error) {
        logToCloudWatch(`Error generating ads for task ${taskId}: ${error.message}`, 'ERROR', 'google');
        this.generateAdsTaskMap.set(taskId, { status: 'error', error: error.message });
      }
    })();
  
    return { status: 'processing', taskId };
  }


  @Get('generateAds/status/:taskId')
  getGenerateAdsStatus(@Param('taskId') taskId: string) {
  const task = this.generateAdsTaskMap.get(taskId);

  if (!task) {
    return { status: 'not_found' };
  }

  return task;

  
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
