import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { Role } from '../entities/role.entity';
import { DefaultRoleName, PERMISSIONS } from '@app/common-dto';
import { isPostgresUniqueViolation } from '../common/db-errors.util';

/** Dam bao moi permission khai bao trong packages/common-dto/enums/permission.enum.ts ton tai trong DB. */
@Injectable()
export class PermissionsSeederService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PermissionsSeederService.name);

  constructor(
    @InjectRepository(Permission) private readonly permissionRepo: Repository<Permission>,
    @InjectRepository(Role) private readonly roleRepo: Repository<Role>,
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
    await this.syncOrgAdminRoles();
  }

  /**
   * 24/10/2026: bo sung permission moi cho vai tro Org Admin cua MOI to chuc da ton tai. Truoc day
   * permission moi (nhan tin 28/09, kho 15/10, chatbot:use 24/10...) chi duoc gan cho to chuc dang
   * ky SAU thoi diem do (seedDefaultRoles) - to chuc cu giu nguyen tap quyen Org Admin cu (do song:
   * to chuc E2E thieu 12 quyen, 10 to chuc khac thieu chatbot:use), trong khi khong ai sua duoc vai
   * tro Org Admin qua API (chan tu sua vai tro dang giu - RolesService.updatePermissions) va giao
   * dien khoa hang Org Admin o trang thai "co tat ca". Org Admin theo dinh nghia co MOI quyen
   * (DEFAULT_ROLE_PERMISSIONS.ORG_ADMIN = Object.values(PERMISSIONS)) nen chi them phan thieu, idempotent.
   * Manager/Employee KHONG tu dong bo sung (ton trong viec Org Admin da chu dong bat/tat) - Org Admin
   * tu cap qua ma tran phan quyen.
   */
  private async syncOrgAdminRoles(): Promise<void> {
    const allPermissions = await this.permissionRepo.find();
    const orgAdminRoles = await this.roleRepo.find({ where: { name: DefaultRoleName.ORG_ADMIN } });
    let updatedRoles = 0;
    for (const role of orgAdminRoles) {
      const owned = new Set((role.permissions ?? []).map((p) => p.id));
      const missing = allPermissions.filter((p) => !owned.has(p.id)).map((p) => p.id);
      if (!missing.length) continue;
      try {
        await this.roleRepo.createQueryBuilder().relation(Role, 'permissions').of(role.id).add(missing);
        updatedRoles++;
      } catch (err) {
        // Nhieu instance khoi dong cung luc co the cung chen 1 dong role_permissions - bo qua nhu tren.
        if (!isPostgresUniqueViolation(err)) throw err;
        this.logger.warn(`Vai tro Org Admin ${role.id} da duoc 1 instance khac dong bo truoc do, bo qua`);
      }
    }
    if (updatedRoles) this.logger.log(`Da bo sung permission moi cho ${updatedRoles} vai tro Org Admin`);
  }
}
