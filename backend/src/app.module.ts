import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { RecommendModule } from './recommend/recommend.js';
import { ShelvesModule } from './shelves/shelves.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, AuthModule, CatalogModule, RecommendModule, ShelvesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
