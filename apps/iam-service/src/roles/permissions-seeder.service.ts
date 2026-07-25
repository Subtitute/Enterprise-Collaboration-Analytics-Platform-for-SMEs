import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { PERMISSIONS } from '@app/common-dto';
import { isPostgresUniqueViolation } from '../common/db-errors.util';

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
        // 25/07/2026: MINOR (review 25/07/2026) - pre-check findOne() o tren khong nguyen tu voi
        // save() ngay duoi (giong tinh huong isPostgresUniqueViolation da tung xu ly cho
        // AuthService.registerOrganization()/UsersService.invite()): neu NHIEU instance cua
        // iam-service cung khoi dong dong thoi (vd scale > 1 replica, hoac restart trung thoi
        // diem), ca 2 co the cung doc thay "chua ton tai" TRUOC KHI 1 ben kip insert xong, roi ca
        // hai cung goi save() cho CUNG 1 `key` - ben insert sau vi pham unique index tren
        // Permission.key va nem loi Postgres tho (code 23505), truoc day KHONG duoc bat nen lam
        // sap ca qua trinh bootstrap (OnApplicationBootstrap nem loi -> Nest dung khoi dong app).
        // Coi 1 xung dot 23505 la "permission nay da duoc 1 instance khac seed xong" (ket qua
        // cuoi cung van dung - permission da ton tai trong DB), log canh bao va tiep tuc thay vi
        // crash toan bo qua trinh khoi dong.
        try {
          await this.permissionRepo.save(this.permissionRepo.create({ key }));
        } catch (err) {
          if (isPostgresUniqueViolation(err)) {
            this.logger.warn(
              `Permission "${key}" da duoc 1 instance khac seed truoc do (unique violation), bo qua`,
            );
            continue;
          }
          throw err;
        }
      }
    }
    this.logger.log(`Da dam bao ${keys.length} permission toan cuc trong DB`);
  }
}
