import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { PERMISSIONS } from '@app/common-dto';
import { ProductCategoriesService } from './product-categories.service';
import { CreateProductCategoryDto } from './dto/create-product-category.dto';
import { UpdateProductCategoryDto } from './dto/update-product-category.dto';
import { ProductCategoryQueryDto } from './dto/product-category-query.dto';

/** Quan ly danh muc san pham - Technical_Spec.md muc 22. */
@ApiTags('Product Categories')
@ApiBearerAuth()
@Controller('product-categories')
export class ProductCategoriesController {
  constructor(private readonly categoriesService: ProductCategoriesService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCT_VIEW)
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: ProductCategoryQueryDto) {
    return this.categoriesService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PRODUCT_VIEW)
  findOne(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.categoriesService.findById(organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  create(@CurrentUser('organizationId') organizationId: string, @Body() dto: CreateProductCategoryDto) {
    return this.categoriesService.create(organizationId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  update(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductCategoryDto,
  ) {
    return this.categoriesService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  remove(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.categoriesService.remove(organizationId, id);
  }
}
