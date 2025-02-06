import { Module } from '@nestjs/common';
import { SpellCheckerService } from './spell-checker.service';
import { SpellCheckerController } from './spell-checker.controller';

@Module({
  controllers: [SpellCheckerController],
  providers: [SpellCheckerService],
})
export class SpellCheckerModule {}
