import { Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { FilesService } from './files.service';
import { FilesController } from './files.controller';

@Module({
  providers: [StorageService, FilesService],
  controllers: [FilesController],
  exports: [StorageService, FilesService],
})
export class FilesModule {}
