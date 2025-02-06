import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpellCheckerModule } from './spell-checker/spell-checker.module';

@Module({
  imports: [SpellCheckerModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
