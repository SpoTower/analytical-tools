import { Module  } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpellCheckerModule } from './spell-checker/spell-checker.module';
import { KnexService } from './knex/knex.service';
import { GlobalStateService } from './globalState/global-state.service';
 import { ConfigModule } from '@nestjs/config';
import { GptModule } from './gpt/gpt.module';

 
@Module({
  imports: [
    ConfigModule.forRoot({
    isGlobal: true, // Makes it accessible in all modules
  }),
  SpellCheckerModule,
  GptModule,
    ],
  controllers: [AppController],
  providers: [AppService,KnexService,GlobalStateService],
})
export class AppModule {}
