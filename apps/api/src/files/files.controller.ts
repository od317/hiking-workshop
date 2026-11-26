import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { FilesService } from './files.service';
import { PresignUploadDto } from './dto/presign-upload.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('presign')
  presign(@Body() dto: PresignUploadDto, @Req() req: { user: { id: string } }) {
    return this.files.presign(dto, req.user.id);
  }

  @Post(':id/confirm')
  confirm(@Param('id', ParseUUIDPipe) id: string) {
    return this.files.confirm(id);
  }

  @Get(':id/url')
  getUrl(@Param('id', ParseUUIDPipe) id: string) {
    return this.files.getSignedUrl(id);
  }
}
