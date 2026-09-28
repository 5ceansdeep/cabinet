import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { PoolService } from './pool.js';
import { VideoService } from './videos.js';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, VideoService, PoolService],
  exports: [CatalogService, VideoService],
})
export class CatalogModule {}
