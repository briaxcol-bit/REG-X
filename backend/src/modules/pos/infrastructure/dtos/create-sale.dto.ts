import { Type } from 'class-transformer'
import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, Min, IsEnum } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

class SaleItemDto {
  @IsString() productId!: string
  @IsOptional() @IsString() variantId?: string
  @IsString() sku!: string
  @IsString() name!: string
  @IsNumber() @Min(0.001) @Type(() => Number) quantity!: number
  @IsNumber() @Min(0) @Type(() => Number) unitPrice!: number
  @IsNumber() @Min(0) @Type(() => Number) discount!: number
  @IsNumber() @Min(0) @Type(() => Number) tax!: number
  @IsOptional() @IsString() notes?: string
}

class PaymentLineDto {
  @IsEnum(['CASH', 'CARD', 'TRANSFER', 'QR', 'GIFT_CARD']) method!: string
  @IsNumber() @Min(0) @Type(() => Number) amount!: number
  @IsOptional() @IsString() reference?: string
}

export class CreateSaleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() cashRegisterId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() customerId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() tableId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string

  @ApiProperty({ type: [SaleItemDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => SaleItemDto)
  items!: SaleItemDto[]

  @ApiProperty({ type: [PaymentLineDto] })
  @IsArray() @ValidateNested({ each: true }) @Type(() => PaymentLineDto)
  payments!: PaymentLineDto[]
}
