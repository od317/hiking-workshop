import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { DesignService } from './design.service';
import { CreatePatternDto } from './dto/create-pattern.dto';
import { CreateSampleDto } from './dto/create-sample.dto';
import { DecideSampleDto } from './dto/decide-sample.dto';

@Controller()
export class DesignController {
  constructor(private readonly design: DesignService) {}

  @Post('orders/:orderId/patterns')
  createPattern(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreatePatternDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.design.createPattern(orderId, dto, req.user.id);
  }

  @Get('orders/:orderId/patterns')
  listPatterns(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.design.listPatterns(orderId);
  }

  @Post('orders/:orderId/samples')
  createSample(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateSampleDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.design.createSample(orderId, dto, req.user.id);
  }

  @Get('orders/:orderId/samples')
  listSamples(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.design.listSamples(orderId);
  }

  @Post('samples/:id/decision')
  decideSample(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideSampleDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.design.decideSample(id, dto, req.user.id);
  }
}
