import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { ProductionService } from './production.service';
import { UpsertOrderLinesDto } from './dto/upsert-lines.dto';
import { RecordCuttingDto } from './dto/record-cutting.dto';
import { CreateHoldDto } from './dto/create-hold.dto';
import { ResolveHoldDto } from './dto/resolve-hold.dto';
import { EnsureColorsDto } from './dto/ensure-colors.dto';

@Controller()
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Post('orders/:orderId/lines')
  upsertLines(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: UpsertOrderLinesDto,
  ) {
    return this.production.upsertLines(orderId, dto);
  }

  @Get('orders/:orderId/production')
  getBoard(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.production.getBoard(orderId);
  }

  @Post('orders/:orderId/cutting')
  recordCutting(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RecordCuttingDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.production.recordCutting(orderId, dto, req.user.id);
  }

  @Post('orders/:orderId/holds')
  createHold(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateHoldDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.production.createHold(orderId, dto, req.user.id);
  }

  @Post('holds/:id/resolve')
  resolveHold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveHoldDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.production.resolveHold(id, dto, req.user.id);
  }

  @Get('orders/:orderId/colors')
  listColors(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.production.listColors(orderId);
  }

  @Post('orders/:orderId/colors')
  ensureColors(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: EnsureColorsDto,
  ) {
    return this.production.ensureColors(orderId, dto.names);
  }

  @Delete('orders/:orderId/colors/:colorId')
  deleteColor(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('colorId', ParseUUIDPipe) colorId: string,
  ) {
    return this.production.deleteColor(orderId, colorId);
  }

  @Delete('orders/:orderId/lines/:lineId')
  deleteLine(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Param('lineId', ParseUUIDPipe) lineId: string,
  ) {
    return this.production.deleteLine(orderId, lineId);
  }
}
