import { Module  } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SpellCheckerModule } from './spell-checker/spell-checker.module';
import { KnexService } from './knex/knex.service';
import { GlobalStateService } from './globalState/global-state.service';
 import { ConfigModule } from '@nestjs/config';
import { GptModule } from './gpt/gpt.module';
import { KnexModule } from './knex/knex.module';
import { AbTestManagementModule } from './ab-test-management/ab-test-management.module';
import { GoogleModule } from './google/google.module';
import { BingModule } from './bing/bing.module';

@Module({
  imports: [
    ConfigModule.forRoot({
    isGlobal: true, // Makes it accessible in all modules
  }),
  SpellCheckerModule,
  GptModule,
  KnexModule,
  AbTestManagementModule,
  GoogleModule,
  BingModule,
    ],
  controllers: [AppController],
  providers: [
    AppService,
    GlobalStateService,
    KnexService,
  ],
})
export class AppModule {}
