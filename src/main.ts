import * as dotenv from 'dotenv';
dotenv.config();
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

 
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: '*', // ✅ for dev. In prod: use specific domain instead of '*'
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });  
  const port = process.env.PORT || 5000;
  await app.listen(port);
 }
bootstrap();
