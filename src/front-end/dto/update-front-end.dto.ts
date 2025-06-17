import { PartialType } from '@nestjs/mapped-types';
import { CreateFrontEndDto } from './create-front-end.dto';

export class UpdateFrontEndDto extends PartialType(CreateFrontEndDto) {}
