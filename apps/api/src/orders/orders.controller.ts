import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { OrderStepType } from '@prisma/client';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateStepDto } from './dto/update-step.dto';
import { ReorderStepsDto } from './dto/reorder-steps.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(@Body() dto: CreateOrderDto, @Req() req: { user: { id: string } }) {
    return this.orders.create(dto, req.user.id);
  }

  @Get()
  findAll(
    @Query('customerId') customerId?: string,
    @Query('search') search?: string,
  ) {
    return this.orders.findAll({ customerId, search });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.findOne(id);
  }

  @Patch(':id/steps/reorder')
  reorderSteps(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderStepsDto,
  ) {
    return this.orders.reorderSteps(id, dto);
  }

  @Patch(':id/steps/:stepType')
  updateStep(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('stepType', new ParseEnumPipe(OrderStepType))
    stepType: OrderStepType,
    @Body() dto: UpdateStepDto,
  ) {
    return this.orders.updateStep(id, stepType, dto);
  }
}
