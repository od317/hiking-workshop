import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { WorkshopsService } from './workshops.service';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { CreateBatchDto } from './dto/create-batch.dto';
import { ReceiveBatchDto } from './dto/receive-batch.dto';
import { CreateWorkshopPaymentDto } from './dto/create-payment.dto';

@Controller()
export class WorkshopsController {
  constructor(private readonly workshops: WorkshopsService) {}

  @Post('workshops')
  create(@Body() dto: CreateWorkshopDto, @Req() req: { user: { id: string } }) {
    return this.workshops.create(dto, req.user.id);
  }

  @Get('workshops')
  findAll(@Query('search') search?: string) {
    return this.workshops.findAll(search);
  }

  @Get('workshops/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workshops.findOne(id);
  }

  @Post('orders/:orderId/workshop-batches')
  createBatch(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateBatchDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.workshops.createBatch(orderId, dto, req.user.id);
  }

  @Get('orders/:orderId/workshop-batches')
  listOrderBatches(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.workshops.listOrderBatches(orderId);
  }

  @Post('workshop-batches/:batchId/receive')
  receiveFromBatch(
    @Param('batchId', ParseUUIDPipe) batchId: string,
    @Body() dto: ReceiveBatchDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.workshops.receiveFromBatch(batchId, dto, req.user.id);
  }

  @Post('workshops/:id/payments')
  recordPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateWorkshopPaymentDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.workshops.recordPayment(id, dto, req.user.id);
  }
}
