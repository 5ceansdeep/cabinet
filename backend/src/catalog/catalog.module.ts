import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { DescribeService } from './describe.js';
import { Gemini } from './gemini.js';
import { PoolService } from './pool.js';
import { SoundService } from './sound.js';
import { VideoService } from './videos.js';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, VideoService, PoolService, SoundService, Gemini, DescribeService],
  exports: [CatalogService, VideoService, Gemini, PoolService, DescribeService],
})
export class CatalogModule {}
