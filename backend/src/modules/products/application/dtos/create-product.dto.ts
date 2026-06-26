import { IsString, IsNumber, IsOptional, IsBoolean, IsEnum, IsArray, Min, Max, IsNotEmpty } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'

export class CreateProductDto {
  @ApiProperty({ example: 'PROD-001' })
  @IsString() @IsNotEmpty()
  sku!: string

  @ApiProperty({ example: 'Coca Cola 500ml' })
  @IsString() @IsNotEmpty()
  name!: string

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  description?: string

  @ApiProperty({ example: 3500 })
  @IsNumber() @Min(0)
  @Type(() => Number)
  price!: number

  @ApiPropertyOptional({ example: 2000 })
  @IsOptional() @IsNumber() @Min(0)
  @Type(() => Number)
  costPrice?: number

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional() @IsString()
  currency?: string

  @ApiProperty({ example: 19, description: 'Tax percentage 0-100' })
  @IsNumber() @Min(0) @Max(100)
  @Type(() => Number)
  tax!: number

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  categoryId?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  brandId?: string

  @ApiPropertyOptional()
  @IsOptional() @IsString()
  imageUrl?: string

  @ApiPropertyOptional({ example: '7501234567890' })
  @IsOptional() @IsString()
  barcode?: string

  @ApiProperty({ example: 'UNIT', enum: ['UNIT', 'KG', 'LT', 'ML', 'M', 'CM', 'BOX', 'PKG'] })
  @IsString()
  unit!: string

  @ApiPropertyOptional({ default: 0 })
  @IsOptional() @IsNumber() @Min(0)
  @Type(() => Number)
  minStock?: number

  @ApiPropertyOptional()
  @IsOptional() @IsNumber()
  @Type(() => Number)
  maxStock?: number

  @ApiPropertyOptional({ default: true })
  @IsOptional() @IsBoolean()
  trackInventory?: boolean

  @ApiPropertyOptional({ default: false })
  @IsOptional() @IsBoolean()
  allowNegativeStock?: boolean

  @ApiPropertyOptional({ isArray: true, type: String })
  @IsOptional() @IsArray() @IsString({ each: true })
  tags?: string[]
}
