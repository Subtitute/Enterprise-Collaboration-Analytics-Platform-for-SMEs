import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { TerminusModule } from '@nestjs/terminus';
import { AllExceptionsFilter, InternalAuthGuard, PermissionsGuard } from '@app/common-guard';
import { HttpMetricsInterceptor, MetricsController, MetricsService } from '@app/common-metrics';
import configuration from './config/configuration';
import { Product } from './entities/product.entity';
import { ProductCategory } from './entities/product-category.entity';
import { Warehouse } from './entities/warehouse.entity';
import { WarehouseStock } from './entities/warehouse-stock.entity';
import { StockMovement } from './entities/stock-movement.entity';
import { CustomerPurchase } from './entities/customer-purchase.entity';
import { OutboxEvent } from './entities/outbox-event.entity';
import { KafkaModule } from './kafka/kafka.module';
import { MinioModule } from './minio/minio.module';
import { OutboxModule } from './outbox/outbox.module';
import { ProductCategoriesModule } from './categories/product-categories.module';
import { ProductsModule } from './products/products.module';
import { WarehousesModule } from './warehouses/warehouses.module';
import { StockModule } from './stock/stock.module';
import { CustomerPurchasesModule } from './customer-purchases/customer-purchases.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres' as const,
        host: config.get<string>('db.host'),
        port: config.get<number>('db.port'),
        username: config.get<string>('db.user'),
        password: config.get<string>('db.password'),
        database: config.get<string>('db.name'),
        entities: [Product, ProductCategory, Warehouse, WarehouseStock, StockMovement, CustomerPurchase, OutboxEvent],
        // MVP: dung synchronize thay vi migration thu cong - mirror moi service khac trong repo
        // (Technical_Spec.md muc 14 - gioi han da biet).
        synchronize: true,
      }),
    }),
    ScheduleModule.forRoot(),
    TerminusModule,
    KafkaModule,
    MinioModule,
    OutboxModule,
    ProductCategoriesModule,
    ProductsModule,
    WarehousesModule,
    StockModule,
    CustomerPurchasesModule,
  ],
  controllers: [HealthController, MetricsController],
  providers: [
    { provide: APP_GUARD, useClass: InternalAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    MetricsService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class AppModule {}
