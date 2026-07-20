import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { AppBaseEntity } from '../common/base.entity';

/**
 * Cay thu muc tai lieu - Technical_Spec.md muc 3.4, muc 5 ("Folder 1-N Folder (cay thu muc)").
 * `parentFolderId` null = thu muc goc cua to chuc.
 */
@Entity('folders')
export class Folder extends AppBaseEntity {
  @Index()
  @Column({ name: 'organization_id' })
  organizationId: string;

  @Column({ name: 'parent_folder_id', type: 'uuid', nullable: true })
  parentFolderId?: string | null;

  @ManyToOne(() => Folder, (folder) => folder.children, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_folder_id' })
  parentFolder?: Folder | null;

  @OneToMany(() => Folder, (folder) => folder.parentFolder)
  children: Folder[];

  @Column()
  name: string;

  @Column({ name: 'created_by_user_id', type: 'uuid' })
  createdByUserId: string;
}
