import {
  Body,
  Controller,
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
}
