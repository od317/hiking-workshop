import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { DeliveryService } from './delivery.service';
import { RecordFinishingDto } from './dto/record-finishing.dto';
import { RecordQualityCheckDto } from './dto/record-qc.dto';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { CreateReturnDto } from './dto/create-return.dto';

@Controller('orders/:orderId')
export class DeliveryController {
  constructor(private readonly delivery: DeliveryService) {}

  @Post('finishing')
  recordFinishing(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RecordFinishingDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.delivery.recordFinishing(orderId, dto, req.user.id);
  }

  @Post('quality-checks')
  recordQualityCheck(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: RecordQualityCheckDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.delivery.recordQualityCheck(orderId, dto, req.user.id);
  }

  @Post('deliveries')
  createDelivery(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateDeliveryDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.delivery.createDelivery(orderId, dto, req.user.id);
  }

  @Post('returns')
  createReturn(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateReturnDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.delivery.createReturn(orderId, dto, req.user.id);
  }

  @Get('fulfillment')
  getFulfillmentSummary(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.delivery.getFulfillmentSummary(orderId);
  }
}
