import 'dotenv/config';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory, Reflector } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';
import {
  ApplicationLogger,
  HttpExceptionFilter,
  requestContextMiddleware,
  ResponseInterceptor,
} from './common';
import {
  Environment,
  EnvironmentValidationError,
  resolveLogLevels,
  validateEnvironment,
} from './config';

const isProduction = process.env.NODE_ENV === 'production';
let applicationLogger = new ApplicationLogger({
  context: 'Bootstrap',
  json: isProduction,
  colors: !isProduction,
  compact: isProduction,
});

async function bootstrap() {
  const environment = validateEnvironment(process.env);

  applicationLogger = new ApplicationLogger({
    context: 'Application',
    json: environment.NODE_ENV === 'production',
    colors: environment.NODE_ENV !== 'production',
    compact: environment.NODE_ENV === 'production',
    logLevels: resolveLogLevels(environment.LOG_LEVEL),
  });

  const app = await NestFactory.create(AppModule, {
    logger: applicationLogger,
    rawBody: true,
  });
  const configService =
    app.get<ConfigService<Environment, true>>(ConfigService);

  app.useLogger(applicationLogger);
  app.use(requestContextMiddleware);
  app.use(cookieParser());
  const expressApplication = app.getHttpAdapter().getInstance() as {
    set: (name: string, value: unknown) => void;
  };
  expressApplication.set('trust proxy', 1);
  app.enableShutdownHooks();

  app.enableCors({
    origin: configService.getOrThrow('CORS_ORIGINS', { infer: true }),
    credentials: true,
    exposedHeaders: ['X-Request-ID'],
  });

  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  app.useGlobalFilters(
    new HttpExceptionFilter(environment.NODE_ENV === 'production'),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  if (environment.NODE_ENV !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Group ERP API')
      .setDescription('ERP Backend APIs')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);

    SwaggerModule.setup('api', app, swaggerDocument);
  }

  const host = configService.getOrThrow('HOST', { infer: true });
  const port = configService.getOrThrow('PORT', { infer: true });

  await app.listen(port, host);

  applicationLogger.log({
    event: 'application.ready',
    host,
    port,
    swaggerPath: '/api',
  });
}

void bootstrap().catch((error: unknown) => {
  const errorName = error instanceof Error ? error.name : 'UnknownStartupError';
  const safeMessage =
    error instanceof EnvironmentValidationError
      ? error.message
      : 'Application startup failed.';
  const includeStack =
    process.env.NODE_ENV !== 'production' &&
    error instanceof Error &&
    !(error instanceof EnvironmentValidationError);

  applicationLogger.error(
    {
      event: 'application.start_failed',
      errorName,
      message: safeMessage,
    },
    includeStack ? error.stack : undefined,
  );

  process.exitCode = 1;
});
