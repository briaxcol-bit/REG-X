import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ThrottlerGuard } from '@nestjs/throttler'
import { RBACGuard, Permissions } from '@shared/guards/rbac.guard'
import { Tenant } from '@shared/decorators/tenant.decorator'
import type { TenantContext } from '@shared/middleware/tenant.middleware'
import { CreateSaleUseCase } from '../../application/use-cases/create-sale.use-case'
import { CreateSaleDto } from '../dtos/create-sale.dto'

@ApiTags('Sales / POS')
@ApiBearerAuth()
@UseGuards(ThrottlerGuard, RBACGuard)
@Controller({ path: 'pos', version: '1' })
export class POSController {
  constructor(private readonly createSale: CreateSaleUseCase) {}

  @Post('sales')
  @Permissions('sales.create')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new sale (POS checkout)' })
  async sale(@Body() dto: CreateSaleDto, @Tenant() tenant: TenantContext) {
    const sale = await this.createSale.execute({
      tenantId:       tenant.tenantId,
      branchId:       tenant.branchId ?? '',
      userId:         tenant.userId,
      currency:       'COP',
      cashRegisterId: dto.cashRegisterId,
      customerId:     dto.customerId,
      tableId:        dto.tableId,
      notes:          dto.notes,
      items:          dto.items,
      payments:       dto.payments,
    })
    return {
      id:            sale.id,
      orderNumber:   sale.orderNumber,
      receiptNumber: sale.receiptNumber,
      total:         sale.total.toJSON(),
      status:        sale.status,
      completedAt:   sale.completedAt,
    }
  }
}
