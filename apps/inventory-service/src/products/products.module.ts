import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerPurchase } from '../entities/customer-purchase.entity';
import { Product } from '../entities/product.entity';
import { ProductCategory } from '../entities/product-category.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, ProductCategory, CustomerPurchase]), OutboxModule],
  providers: [ProductsService],
  controllers: [ProductsController],
  exports: [ProductsService],
})
export class ProductsModule {}
