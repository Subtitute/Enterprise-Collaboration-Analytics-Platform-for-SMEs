import { memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Select } from '@/components/ui/Input';
import { PERMISSIONS } from '@/constants/permissions';
import { usePermissions } from '@/stores/auth.store';
import type { Folder } from '@/types';
import { useDocumentProjects, useUpdateFolderProject } from '../hooks';

/**
 * 26/10/2026: tai lieu theo pham vi du an - cac mau UI nho dung chung cho tao/doi thu muc va trang
 * Tai lieu. Kiem tra o CLIENT chi de an/hien (vd lua chon "Toan cong ty" chi Org Admin thay), backend
 * (FoldersService) moi la noi thuc thi quyen that su.
 */
export function useIsOrgAdmin(): boolean {
  return usePermissions().includes(PERMISSIONS.ORG_MANAGE);
}

/** Select du an; gia tri '' = toan cong ty (chi Org Admin co lua chon nay). */
export const FolderProjectSelect = memo(function FolderProjectSelect({
  id,
  value,
  onChange,
  error,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const { t } = useTranslation();
  const isOrgAdmin = useIsOrgAdmin();
  const { options, isLoading } = useDocumentProjects();
  const noProjects = !isLoading && !isOrgAdmin && options.length === 0;

  return (
    <FormField
      label={t('documents:projectScope.label')}
      htmlFor={id}
      error={error}
      hint={noProjects ? t('documents:projectScope.noProjects') : t('documents:projectScope.hint')}
      required={!isOrgAdmin}
    >
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} disabled={isLoading || noProjects}>
        {isOrgAdmin ? (
          <option value="">{t('documents:projectScope.companyWideOption')}</option>
        ) : (
          <option value="" disabled>
            {t('documents:projectScope.placeholder')}
          </option>
        )}
        {options.map((project) => (
          <option key={project.id} value={project.id}>
            {project.name}
          </option>
        ))}
      </Select>
    </FormField>
  );
});

/** Nhan du an tren the thu muc cap goc: ten du an, hoac "Toan cong ty" khi khong gan du an. */
export const FolderProjectBadge = memo(function FolderProjectBadge({ folder, projectNames }: { folder: Folder; projectNames: Map<string, string> }) {
  const { t } = useTranslation();
  if (folder.parentId) return null;
  const label = folder.projectId
    ? projectNames.get(folder.projectId) ?? t('documents:projectScope.unknownProject')
    : t('documents:projectScope.companyWide');
  return (
    <span
      title={label}
      className={`inline-flex max-w-[160px] shrink-0 items-center truncate rounded-full px-2 py-0.5 text-[11px] font-medium ${
        folder.projectId ? 'bg-accent-soft text-accent' : 'bg-bg-subtle text-text-secondary'
      }`}
    >
      {label}
    </span>
  );
});

/** Doi du an cua thu muc cap goc (nguoi tao/Org Admin; chuyen sang toan cong ty chi Org Admin). */
export const FolderProjectModal = memo(function FolderProjectModal({ folder, onClose }: { folder: Folder | null; onClose: () => void }) {
  const { t } = useTranslation();
  const updateProject = useUpdateFolderProject();
  const isOrgAdmin = useIsOrgAdmin();
  const [value, setValue] = useState<string | null>(null);
  const [error, setError] = useState('');
  const current = value ?? folder?.projectId ?? '';

  function handleClose() {
    setValue(null);
    setError('');
    onClose();
  }

  function handleSave() {
    if (!folder) return;
    if (!current && !isOrgAdmin) {
      setError(t('documents:projectScope.requiredError'));
      return;
    }
    updateProject.mutate({ id: folder.id, projectId: current || null }, { onSuccess: handleClose });
  }

  return (
    <Modal
      open={Boolean(folder)}
      onClose={handleClose}
      preventCloseWhilePending={updateProject.isPending}
      title={t('documents:projectScope.changeTitle')}
      size="sm"
    >
      <div className="space-y-4">
        <FolderProjectSelect
          id="folder-project-change"
          value={current}
          onChange={(next) => {
            setValue(next);
            setError('');
          }}
          error={error}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose} disabled={updateProject.isPending} className="h-9 rounded-radius-sm border-border-strong text-[13px]">
            {t('documents:projectScope.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} isLoading={updateProject.isPending} className="h-9 rounded-radius-sm bg-text-primary hover:bg-black text-[13px] font-medium">
            {t('documents:projectScope.save')}
          </Button>
        </div>
      </div>
    </Modal>
  );
});
