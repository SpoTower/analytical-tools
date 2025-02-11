import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { loadDBCredentials, loadKidonDBCredentials } from './utils/secrets';

 
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await Promise.all([loadDBCredentials, loadKidonDBCredentials]);
  const port = process.env.PORT || 5000;
  await app.listen(port);
}
bootstrap();
