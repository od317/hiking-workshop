import { randomUUID } from 'crypto';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { HealthController } from './health/health.controller';
import { validateEnv } from './config/env';
import { PrismaModule } from './prisma/prisma.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty' },
        genReqId: (req) => {
          const header = req.headers['x-request-id'];
          return (Array.isArray(header) ? header[0] : header) ?? randomUUID();
        },
      },
    }),
    PrismaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
