import { ArrayMinSize, IsArray, IsString } from 'class-validator';

export class UpdateCbtServiceCategoriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  serviceCategoryIds: string[];
}
