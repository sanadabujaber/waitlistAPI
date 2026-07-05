import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';

// Prisma BigInt primary keys → JSON strings.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet({ contentSecurityPolicy: false }));
  // Bearer-token auth only (no cookies), so reflecting the origin is safe and
  // lets the static marketing page call the API from any host.
  app.enableCors({ origin: true });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Standalone Swagger doc for this service. Dev-only unless ENABLE_SWAGGER=true.
  if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle('Sanad Waitlist API')
      .setDescription(
        'Standalone pre-launch service: public waitlist signup + survey, and the admin dashboard endpoints. ' +
          'Runs independently of the main platform API.',
      )
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  const port = process.env.PORT ?? 3005;
  await app.listen(port);
  console.log(`🚀 Waitlist API running on http://localhost:${port}/api`);
  console.log(`📚 Swagger at http://localhost:${port}/api/docs`);
}
bootstrap();
