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
import { MaterialKind } from '@prisma/client';
import { MaterialsService } from './materials.service';
import { CreateMaterialDto } from './dto/create-material.dto';
import { CreateMovementDto } from './dto/create-movement.dto';
import { AddOrderMaterialDto } from './dto/add-order-material.dto';

@Controller()
export class MaterialsController {
  constructor(private readonly materials: MaterialsService) {}

  @Post('materials')
  create(@Body() dto: CreateMaterialDto, @Req() req: { user: { id: string } }) {
    return this.materials.create(dto, req.user.id);
  }

  @Get('materials')
  findAll(
    @Query('kind') kind?: MaterialKind,
    @Query('search') search?: string,
  ) {
    return this.materials.findAll({ kind, search });
  }

  @Get('materials/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.materials.findOne(id);
  }

  @Post('materials/:id/movements')
  recordMovement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateMovementDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.materials.recordMovement(id, dto, req.user.id);
  }

  @Post('orders/:orderId/materials')
  addOrderMaterial(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: AddOrderMaterialDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.materials.addOrderMaterial(orderId, dto, req.user.id);
  }

  @Get('orders/:orderId/materials')
  listOrderMaterials(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Query('kind') kind?: MaterialKind,
  ) {
    return this.materials.listOrderMaterials(orderId, kind);
  }
}
