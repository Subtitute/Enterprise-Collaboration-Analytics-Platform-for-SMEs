import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { PERMISSIONS } from '@app/common-dto';

/** Dam bao moi permission khai bao trong packages/common-dto/enums/permission.enum.ts ton tai trong DB. */
@Injectable()
export class PermissionsSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionsSeederService.name);

  constructor(
    @InjectRepository(Permission) private readonly permissionRepo: Repository<Permission>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const keys = Object.values(PERMISSIONS);
    for (const key of keys) {
      const exists = await this.permissionRepo.findOne({ where: { key } });
      if (!exists) {
        await this.permissionRepo.save(this.permissionRepo.create({ key }));
      }
    }
    this.logger.log(`Da dam bao ${keys.length} permission toan cuc trong DB`);
  }
}
