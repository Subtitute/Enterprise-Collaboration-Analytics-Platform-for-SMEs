import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';
import { Folder } from './folder.entity';

/**
 * 28/07/2026: entity moi - chia se thu muc RESTRICTED cho 1 nguoi dung CU THE hoac 1 phong ban CU
 * THE (yeu cau nhiem vu: kiem soat truy cap tai lieu theo thu muc, opt-in). Khac voi `FileShare`
 * (chi dung de FE hien thi/kich hoat thong bao, KHONG phai co che chan truy cap thuc su - xem
 * file-share.entity.ts), 1 dong `FolderShare` la co che chan truy cap THUC SU: no la 1 trong cac
 * dieu kien cho phep truy cap 1 thu muc `visibility = RESTRICTED` (xem
 * FolderAccessService.canAccessFolder).
 *
 * Dung CHINH XAC 1 trong 2 cot `sharedWithUserId`/`sharedWithDepartmentId` (khong duoc ca hai,
 * khong duoc bo trong ca hai) - rang buoc nay duoc kiem tra o TANG SERVICE
 * (FoldersService.createShare), khong dung CHECK constraint DB (codebase nay khong dung check
 * constraint - giu nguyen quy uoc, xem cung quyet dinh o FileShare).
 */
@Entity('folder_shares')
export class FolderShare extends AppBaseEntity {
  @Column({ name: 'folder_id', type: 'uuid' })
  folderId: string;

  @ManyToOne(() => Folder, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folder_id' })
  folder: Folder;

  @Column({ name: 'shared_with_user_id', type: 'uuid', nullable: true })
  sharedWithUserId: string | null;

  @Column({ name: 'shared_with_department_id', type: 'uuid', nullable: true })
  sharedWithDepartmentId: string | null;

  @Column({ name: 'shared_by_user_id', type: 'uuid' })
  sharedByUserId: string;
}
