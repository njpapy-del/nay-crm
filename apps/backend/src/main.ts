import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import * as path from 'path';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // needed for Stripe webhook signature verification
  });

  app.use(helmet());

  // Servir les enregistrements audio Asterisk en statique
  const recordingsPath = process.env.RECORDINGS_PATH ?? '/var/spool/asterisk/monitor';
  app.useStaticAssets(path.resolve(recordingsPath), { prefix: '/recordings' });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3001;

  // CORS — origins autorisées : frontend local + domaine Cloudflare Tunnel
  const rawOrigins = [
    process.env.FRONTEND_URL    ?? 'http://localhost:3000',
    process.env.FRONTEND_CF_URL ?? '',   // ex: https://app.lnaycrm.com
  ];
  const allowedOrigins = rawOrigins
    .flatMap((o) => o.split(','))
    .map((o) => o.trim())
    .filter(Boolean);

  app.enableCors({
    origin: (origin, cb) => {
      // Autoriser les requêtes sans origin (curl, Postman, SSR) et les origins listées
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error(`CORS bloqué pour ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'CF-Connecting-IP'],
  });

  // Trust Cloudflare proxy (X-Forwarded-For, CF-Connecting-IP pour throttler/logs)
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // Global pipes, filters, interceptors
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Swagger (dev only)
  if (configService.get('nodeEnv') !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('LNAYCRM API')
      .setDescription('CRM & Call Center API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(port);
  console.log(`🚀 Backend running on http://localhost:${port}/api/v1`);
  console.log(`📚 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
