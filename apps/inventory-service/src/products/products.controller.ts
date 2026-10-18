import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { CurrentUser, RequirePermissions } from '@app/common-guard';
import { ERROR_CODES, PERMISSIONS } from '@app/common-dto';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductQueryDto } from './dto/product-query.dto';
import { productImageMimeTypeFileFilter } from './product-image-mime-types';

const MAX_IMAGE_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024;

/** Quan ly san pham trong danh muc - Technical_Spec.md muc 22. */
@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PRODUCT_VIEW)
  findAll(@CurrentUser('organizationId') organizationId: string, @Query() query: ProductQueryDto) {
    return this.productsService.findAll(organizationId, query);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PRODUCT_VIEW)
  findOne(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.productsService.findById(organizationId, id);
  }

  @Post()
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  create(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Body() dto: CreateProductDto,
  ) {
    return this.productsService.create(organizationId, actorId, dto);
  }

  @Patch(':id')
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  update(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(organizationId, id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  remove(
    @CurrentUser('organizationId') organizationId: string,
    @CurrentUser('userId') actorId: string,
    @Param('id') id: string,
  ) {
    return this.productsService.remove(organizationId, actorId, id);
  }

  @Post(':id/image')
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_IMAGE_UPLOAD_SIZE_BYTES },
      fileFilter: productImageMimeTypeFileFilter,
    }),
  )
  setImage(
    @CurrentUser('organizationId') organizationId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException({ message: 'Thieu anh can tai len', errorCode: ERROR_CODES.MISSING_UPLOAD_FILE });
    return this.productsService.setImage(organizationId, id, file);
  }

  @Delete(':id/image')
  @RequirePermissions(PERMISSIONS.PRODUCT_MANAGE)
  removeImage(@CurrentUser('organizationId') organizationId: string, @Param('id') id: string) {
    return this.productsService.removeImage(organizationId, id);
  }
}
