import { Controller, Get, Post, Body, Patch, Param, Delete, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common';
import { AbTestManagementService } from './ab-test-management.service';
import { CreateAbTestManagementDto } from './dto/create-ab-test-management.dto';
import { UpdateAbTestManagementDto } from './dto/update-ab-test-management.dto';

@Controller('ab-test-management')
export class AbTestManagementController {
  constructor(private readonly abTestManagementService: AbTestManagementService) {}

  @Post()
  create(@Body() createAbTestManagementDto: CreateAbTestManagementDto) {
    return this.abTestManagementService.create(createAbTestManagementDto);
  }

  @Get()
  findAll() {
    return this.abTestManagementService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.abTestManagementService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAbTestManagementDto: UpdateAbTestManagementDto) {
    return this.abTestManagementService.update(+id, updateAbTestManagementDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.abTestManagementService.delete(+id);
  }

  @Post('ab-tests')
  getABTestsFromKidon(
    @Query('hoursBack', new DefaultValuePipe(1), ParseIntPipe ) hoursBack: number,
  ){
    return this.abTestManagementService.processAbTestEvents(hoursBack);
  }
}
