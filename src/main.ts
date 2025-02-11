import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadDBCredentials } from './utils/secrets';

 
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await loadDBCredentials();
  const port = process.env.PORT || 5000;
  await app.listen(port);
}
bootstrap();
