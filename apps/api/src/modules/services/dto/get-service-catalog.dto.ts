import { IsOptional, IsString } from 'class-validator';

export class GetServiceCatalogQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  categorySlug?: string;
}
