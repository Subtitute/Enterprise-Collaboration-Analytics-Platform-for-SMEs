import { Module } from '@nestjs/common';
import { ProjectScopeService } from './project-scope.service';
import { ProjectScopeSyncService } from './project-scope-sync.service';

// 26/10/2026: read-model tai lieu theo pham vi du an (backfill + consumer Kafka) - phan DOC cua
// read-model nam o FolderAccessService (GRANTS_SQL), module nay chi GHI nen khong export gi.
@Module({
  providers: [ProjectScopeService, ProjectScopeSyncService],
})
export class ProjectScopeModule {}
