import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Dropdown, DropdownItem } from '@/components/ui/Dropdown';
import { ConfirmDialog } from '@/components/ui/Modal';
import { CalendarIcon, CheckCircleIcon, MoreVerticalIcon, TrashIcon } from '@/components/ui/Icons';
import { formatDate } from '@/lib/utils';
import type { Project } from '@/types';
import { projectStatusMeta } from '../utils';
import { useCompleteProject, useDeleteProject } from '../hooks';

export function ProjectCard({ project, progress }: { project: Project; progress: number }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const status = projectStatusMeta(project.status);
  const complete = useCompleteProject(project.id);
  const del = useDeleteProject();

  return (
    <>
      <Card className="flex flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <Link to={`/projects/${project.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 hover:text-primary-700">{project.name}</p>
          </Link>
          <Dropdown
            trigger={({ toggle }) => (
              <button
                onClick={toggle}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Tùy chọn dự án"
              >
                <MoreVerticalIcon className="h-4 w-4" />
              </button>
            )}
          >
            {({ close }) => (
              <div className="w-48 py-1.5">
                {project.status !== 'COMPLETED' && (
                  <DropdownItem
                    onClick={() => {
                      complete.mutate();
                      close();
                    }}
                  >
                    <CheckCircleIcon className="h-4 w-4" /> Đánh dấu hoàn thành
                  </DropdownItem>
                )}
                <DropdownItem
                  className="text-rose-600 hover:bg-rose-50"
                  onClick={() => {
                    setConfirmDelete(true);
                    close();
                  }}
                >
                  <TrashIcon className="h-4 w-4" /> Xoá dự án
                </DropdownItem>
              </div>
            )}
          </Dropdown>
        </div>

        {project.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{project.description}</p>}

        <div className="mt-3 flex items-center gap-2">
          <Badge variant={status.variant}>{status.label}</Badge>
          {project.dueDate && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <CalendarIcon className="h-3.5 w-3.5" /> {formatDate(project.dueDate)}
            </span>
          )}
        </div>

        <div className="mt-4">
          <ProgressBar value={progress} showLabel />
        </div>
      </Card>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          del.mutate(project.id);
          setConfirmDelete(false);
        }}
        title="Xoá dự án này?"
        description={`Toàn bộ công việc thuộc "${project.name}" cũng có thể bị xoá. Hành động này không thể hoàn tác.`}
        confirmLabel="Xoá dự án"
        danger
      />
    </>
  );
}
