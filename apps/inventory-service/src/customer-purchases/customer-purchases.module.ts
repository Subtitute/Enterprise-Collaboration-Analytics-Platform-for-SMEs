import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomerPurchase } from '../entities/customer-purchase.entity';
import { Product } from '../entities/product.entity';
import { Warehouse } from '../entities/warehouse.entity';
import { OutboxModule } from '../outbox/outbox.module';
import { StockModule } from '../stock/stock.module';
import { CustomerPurchasesService } from './customer-purchases.service';
import { CustomerPurchasesController } from './customer-purchases.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerPurchase, Product, Warehouse]), OutboxModule, StockModule],
  providers: [CustomerPurchasesService],
  controllers: [CustomerPurchasesController],
  exports: [CustomerPurchasesService],
})
export class CustomerPurchasesModule {}
