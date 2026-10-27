import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { OutboxService } from '../outbox/outbox.service';
import { DefaultRoleName, EVENT_TYPES, UserDepartmentChangedPayload, UserRolesChangedPayload, resolveRoleLevel } from '@app/common-dto';

/**
 * 28/07/2026: service moi - resync toan bo departmentId cua MOI user (TAT CA to chuc, khong chi 1
 * to chuc) vao outbox MOI LAN iam-service khoi dong, phuc vu tinh nang KPI theo phong ban cua
 * Analytics Service (xem UserDepartmentChangedPayload, packages/common-dto). Analytics Service
 * khong doc truc tiep DB cua iam-service (moi service so huu du lieu rieng - Technical_Spec.md muc
 * 4), ma tu xay/cap nhat 1 bang tra cuu user_id -> department_id rieng chi qua 2 event tren Kafka
 * topic KAFKA_TOPICS.IAM: USER_REGISTERED (luc tao user moi, da mang san departmentId) va
 * USER_DEPARTMENT_CHANGED (luc doi phong ban cua user DA TON TAI sau nay - xem UsersService.update()).
 *
 * VAN DE can giai quyet: Kafka topic co retention huu han - neu bang tra cuu cua Analytics bi lech
 * so voi iam-service (vd message cu roi ra ngoai retention truoc khi Analytics kip tieu thu lan
 * dau, hoac bang tra cuu cua Analytics bi xoa/reset thu cong luc debug/nang cap), Analytics se
 * KHONG CON CACH NAO tu phuc hoi lai du lieu dung vi khong the "doc lai" cac message da mat.
 *
 * GIAI PHAP (co chu dich, hoi khac thuong nen can giai thich ro): moi lan iam-service khoi dong,
 * PHAT LAI (re-publish) snapshot departmentId HIEN TAI cua TAT CA user nhu 1 outbox event
 * USER_DEPARTMENT_CHANGED - khong phai 1 lan duy nhat kieu migration/seed, ma la MOT BUOC LAP LAI O
 * MOI LAN KHOI DONG. Day la LUA CHON AN TOAN vi idempotent hoan toan: Analytics duoc thiet ke tieu
 * thu event nay theo kieu "gia tri moi nhat thang" (last-value-wins upsert theo userId), nen phat
 * lai du lieu KHONG DOI bao nhieu lan cung hoan toan vo hai - va con la co che TU LANH (self-heal)
 * cho bang tra cuu cua Analytics neu no tung bi lech vi ly do o tren, hoan toan khong can can thiep
 * thu cong.
 *
 * GIOI HAN QUY MO (quan trong - can luu y khi doc lai code nay): cach lam "phat lai TOAN BO user
 * moi lan khoi dong" CHI phu hop voi quy mo do an tot nghiep hien tai (vai chuc den vai tram user
 * tren toan nen tang) - 1 query + 1 transaction ghi vai tram ban ghi outbox la cuc re, khong dang
 * lo. O quy mo production THAT (hang trieu user), day se la MOT ANTI-PATTERN: moi lan
 * restart/deploy (co the xay ra nhieu lan/ngay trong 1 he thong that) se tao ra 1 dot ghi hang
 * trieu ban ghi outbox + publish hang trieu message Kafka hoan toan khong can thiet cho >99.99%
 * user chua he doi phong ban, gay ton tai nguyen DB/Kafka/consumer va co the lam cham qua trinh
 * khoi dong. O quy mo do, cach lam dung se la: (a) chi dua vao 2 event phat KHI CO THAY DOI THUC SU
 * (USER_REGISTERED/USER_DEPARTMENT_CHANGED da co san) lam nguon du lieu chinh, va (b) neu can 1 co
 * che tu-lanh, dung 1 batch reconciliation job chay DINH KY (vd cron hang ngay/hang tuan, KHONG
 * phai moi lan khoi dong), co phan trang/batching that su va gioi han tan suat - thay vi toan bo
 * user + moi lan restart nhu o day.
 */
@Injectable()
export class UserDepartmentSyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(UserDepartmentSyncService.name);
  private static readonly PRODUCER = 'iam-service';

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly outboxService: OutboxService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.backfillDefaultRoles();
    // 28/07/2026: dung createQueryBuilder() (API cap thap) thay vi userRepo.find() de lay du lieu
    // "lean" chi 3 cot can dung - User.roles duoc khai bao eager: true (xem entities/user.entity.ts)
    // nen repo.find()/findOne() se TU DONG JOIN them bang user_roles/roles du khong can den, con
    // createQueryBuilder() khong tu ap eager relation, cho phep SELECT dung 3 cot va bo qua phan
    // con lai cua entity (fullName/passwordHash/isActive/roles...) hoan toan khong can cho tac vu
    // nay.
    // 26/10/2026: nap them ten vai tro de resync muc vai tro (iam.user.roles_changed) cho ml-service -
    // thay cho "script 1 lan" trong Technical_Spec.md muc 27.4: cung co che tu lanh, idempotent nhu
    // departmentId (last-value-wins theo userId), khong can chay tay.
    const users = await this.userRepo
      .createQueryBuilder('u')
      .leftJoin('u.roles', 'r')
      .select(['u.id', 'u.organizationId', 'u.departmentId', 'u.isActive', 'r.id', 'r.name'])
      .getMany();

    if (users.length === 0) {
      this.logger.log('Khong co user nao trong he thong de resync departmentId vao outbox');
      return;
    }

    // 28/07/2026: ghi toan bo trong 1 transaction duy nhat, khong chia batch - quy mo do an tot
    // nghiep hien tai (vai chuc-vai tram user) khong dat ra van de hieu nang nao dang ke; xem chu
    // thich "GIOI HAN QUY MO" o dau file ve ly do cach lam nay KHONG phu hop o quy mo production
    // that.
    await this.dataSource.transaction(async (manager) => {
      for (const user of users) {
        // 23/09/2026: actorId luon null o day - day la 1 buoc TU DONG phat lai (resync) luc khoi
        // dong, khong phai do 1 nguoi vua thao tac (xem UserDepartmentChangedPayload.actorId,
        // packages/common-dto). Ghi ro null (khong bo qua field) de phan biet ro voi truong hop
        // that su co actor tu UsersService.update().
        const payload: UserDepartmentChangedPayload = {
          userId: user.id,
          departmentId: user.departmentId ?? null,
          actorId: null,
        };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.USER_DEPARTMENT_CHANGED,
          organizationId: user.organizationId,
          producer: UserDepartmentSyncService.PRODUCER,
          payload: payload as unknown as Record<string, unknown>,
        });
        const rolesPayload: UserRolesChangedPayload = {
          userId: user.id,
          roleLevel: resolveRoleLevel((user.roles ?? []).map((r) => r.name)),
          actorId: null,
          // 26/10/2026: trang thai hoat dong cho ml-service (chan tai anh ho cho tai khoan bi vo hieu hoa).
          isActive: user.isActive !== false,
        };
        await this.outboxService.record(manager, {
          eventType: EVENT_TYPES.USER_ROLES_CHANGED,
          organizationId: user.organizationId,
          producer: UserDepartmentSyncService.PRODUCER,
          payload: rolesPayload as unknown as Record<string, unknown>,
        });
      }
    });

    this.logger.log(
      `Da resync departmentId cua ${users.length} user (tat ca to chuc) vao outbox luc khoi dong`,
    );
  }

  /**
   * 26/10/2026: buoc 1 LAN moi lan khoi dong, idempotent - user DANG HOAT DONG nhung 0 vai tro (do
   * Manager moi truoc ngay nay, khi invite() chua gan vai tro mac dinh) duoc gan vai tro "Employee" cua
   * chinh to chuc minh. Bo qua Super Admin va to chuc khong co vai tro Employee. Chay TRUOC resync o
   * duoi nen muc vai tro gui sang ml-service da dung.
   */
  async backfillDefaultRoles(): Promise<number> {
    try {
      const rows: { user_id: string }[] = await this.dataSource.query(
        `INSERT INTO user_roles (user_id, role_id)
         SELECT u.id, r.id FROM users u
         JOIN roles r ON r.organization_id = u.organization_id AND r.name = $1
         WHERE u.is_active = true AND u.is_super_admin = false
           AND NOT EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id)
         RETURNING user_id`,
        [DefaultRoleName.EMPLOYEE],
      );
      if (rows?.length) this.logger.log(`Da gan vai tro Employee mac dinh cho ${rows.length} user chua co vai tro nao`);
      return rows?.length ?? 0;
    } catch (err) {
      this.logger.warn(`Khong gan duoc vai tro mac dinh: ${err instanceof Error ? err.message : String(err)}`);
      return 0;
    }
  }
}
