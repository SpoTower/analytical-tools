import { PartialType } from '@nestjs/mapped-types';
import { CreateSpellCheckerDto } from './create-spell-checker.dto';

export class UpdateSpellCheckerDto extends PartialType(CreateSpellCheckerDto) {}
