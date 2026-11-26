import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreateCustomerPaymentDto } from './dto/create-customer-payment.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';

@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}

  @Post('orders/:orderId/invoices')
  createInvoice(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Body() dto: CreateInvoiceDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.finance.createInvoice(orderId, dto, req.user.id);
  }

  @Post('invoices/:invoiceId/payments')
  recordCustomerPayment(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() dto: CreateCustomerPaymentDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.finance.recordCustomerPayment(invoiceId, dto, req.user.id);
  }

  @Post('expenses')
  createExpense(
    @Body() dto: CreateExpenseDto,
    @Req() req: { user: { id: string } },
  ) {
    return this.finance.createExpense(dto, req.user.id);
  }

  @Get('orders/:orderId/finance')
  getOrderFinance(@Param('orderId', ParseUUIDPipe) orderId: string) {
    return this.finance.getOrderFinance(orderId);
  }
}
