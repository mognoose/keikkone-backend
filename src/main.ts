import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';
import type { Env } from './config/env.js';

async function bootstrap() {
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule),
  );
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  if (config.get('SWAGGER_ENABLED', { infer: true })) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('Keikkone API')
        .setDescription('Concert events, friends and who is going where.')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build(),
    );
    // UI at /docs, raw spec at /docs-json for client SDK generators.
    SwaggerModule.setup('docs', app, document, {
      jsonDocumentUrl: 'docs-json',
    });
  }

  await app.listen(config.get('PORT', { infer: true }));
}
await bootstrap();
