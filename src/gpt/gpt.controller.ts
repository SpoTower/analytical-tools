import { Controller, Get,Put, Post, Body, Patch, Param, Delete,Query} from '@nestjs/common';
import { GptService } from './gpt.service';
import { CreateGptDto } from './dto/create-gpt.dto';
import { UpdateGptDto } from './dto/update-gpt.dto';
import { UpdatePromptDto } from './dto/update-prompts.dto';
@Controller('gpt')
export class GptController {
  constructor(private readonly gptService: GptService) {}

  @Post()
  create(@Body() createGptDto: CreateGptDto) {
    return this.gptService.create(createGptDto);
  }

  @Get()
  async findAll(@Query('prompts') prompts?: string) {
    if (prompts) {
      const promptArray = prompts.split(',').map(prompt => prompt.trim());
      return this.gptService.findConfigurationByKeys(promptArray);
    }
    return this.gptService.findAll();
  }

  @Put()
  async updatePrompt(@Body() updatePromptDto: UpdatePromptDto) {
    return this.gptService.updateConfigurationPrompt(updatePromptDto[0]);
  }
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gptService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateGptDto: UpdateGptDto) {
    return this.gptService.update(+id, updateGptDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.gptService.remove(+id);
  }
}
