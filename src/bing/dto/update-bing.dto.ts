import { PartialType } from '@nestjs/mapped-types';
import { CreateBingDto } from './create-bing.dto';

export class UpdateBingDto extends PartialType(CreateBingDto) {}
