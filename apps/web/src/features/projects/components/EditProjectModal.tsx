import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Avatar } from '@/components/ui/Avatar';
import { SearchIcon, CheckIcon } from '@/components/ui/Icons';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { useUpdateProject } from '../hooks';
import type { Project } from '@/types';

interface EditProjectModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
}

export function EditProjectModal({ open, onClose, project }: EditProjectModalProps) {
  const { t } = useTranslation();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const usersQuery = useOrgUsersQuery({ enabled: open });

  // Đọc metadata hiện tại từ localStorage
  const currentMeta = (() => {
    try {
      const store = JSON.parse(localStorage.getItem('ec_projects_metadata') || '{}');
      return store[project.id] ?? {};
    } catch {
      return {};
    }
  })();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || '');
  const [dueDate, setDueDate] = useState(project.dueDate ? project.dueDate.slice(0, 10) : '');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>(currentMeta.priority ?? 'MEDIUM');
  const [leadId, setLeadId] = useState<string>(currentMeta.leadId ?? '');
  const [memberSearch, setMemberSearch] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [error, setError] = useState('');

  const updateProject = useUpdateProject(project.id);

  useEffect(() => {
    if (open) {
      setName(project.name);
      setDescription(project.description || '');
      setDueDate(project.dueDate ? project.dueDate.slice(0, 10) : '');
      const meta = (() => {
        try {
          const store = JSON.parse(localStorage.getItem('ec_projects_metadata') || '{}');
          return store[project.id] ?? {};
        } catch {
          return {};
        }
      })();
      setPriority(meta.priority ?? 'MEDIUM');
      setLeadId(meta.leadId ?? '');
      setError('');
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [open, project]);

  const allUsers = usersQuery.data ?? [];
  const selectedLead = allUsers.find((u) => u.id === leadId);

  const filteredUsers = allUsers.filter((u) =>
    u.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('projects:newProjectModal.nameRequired'));
      nameInputRef.current?.focus();
      return;
    }

    updateProject.mutate(
      {
        name: name.trim(),
        description: description.trim(),
        dueDate: dueDate || undefined,
      },
      {
        onSuccess: () => {
          try {
            const metaStore: Record<string, { priority?: string; leadId?: string; status?: string }> = JSON.parse(
              localStorage.getItem('ec_projects_metadata') || '{}'
            );
            metaStore[project.id] = {
              ...(metaStore[project.id] || {}),
              priority,
              leadId,
            };
            localStorage.setItem('ec_projects_metadata', JSON.stringify(metaStore));
            window.dispatchEvent(new Event('ec_projects_updated'));
          } catch {
            // ignore
          }
          onClose();
        },
      },
    );
  }

  const PRIORITY_OPTIONS = [
    { value: 'LOW', label: t('projects:newProjectModal.priorities.LOW'), color: 'text-slate-600 bg-slate-50 border-slate-200' },
    { value: 'MEDIUM', label: t('projects:newProjectModal.priorities.MEDIUM'), color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { value: 'HIGH', label: t('projects:newProjectModal.priorities.HIGH'), color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { value: 'URGENT', label: t('projects:newProjectModal.priorities.URGENT'), color: 'text-rose-700 bg-rose-50 border-rose-200' },
  ] as const;

  return (
    <Modal open={open} onClose={onClose} title={t('projects:editProjectModal.title')} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Tên dự án */}
        <FormField label={t('projects:newProjectModal.nameLabel')} htmlFor="edit-project-name" error={error} required>
          <Input
            ref={nameInputRef}
            id="edit-project-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            placeholder={t('projects:newProjectModal.namePlaceholder')}
            className={error ? 'border-rose-400 focus:ring-rose-200' : ''}
          />
        </FormField>

        {/* Mô tả dự án */}
        <FormField label={t('projects:newProjectModal.descriptionLabel')} htmlFor="edit-project-description">
          <Textarea
            id="edit-project-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('projects:newProjectModal.descriptionPlaceholder')}
            className="resize-none"
          />
        </FormField>

        {/* Hàng 2 cột: Hạn hoàn thành & Độ ưu tiên (Cùng hàng, dòng, chiều cao h-9 ngang nhau tuyệt đối) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="edit-project-due-date">
              {t('projects:newProjectModal.dueDateLabel')}
            </label>
            <DatePicker id="edit-project-due-date" value={dueDate} onChange={setDueDate} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {t('projects:newProjectModal.priorityLabel')}
              </label>
              {!priority && (
                <span className="text-[11px] font-medium text-rose-500">
                  {t('projects:newProjectModal.priorityRequired')}
                </span>
              )}
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {PRIORITY_OPTIONS.map((opt) => {
                const isSelected = priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`flex h-9 items-center justify-center rounded-lg border text-xs font-semibold transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? `${opt.color} ring-2 ring-primary-500 font-bold shadow-xs`
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Người phụ trách */}
        <div className="relative">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            {t('projects:newProjectModal.leadLabel')}
          </label>

          <div className="relative">
            {selectedLead && !isMemberDropdownOpen ? (
              <div
                onClick={() => setIsMemberDropdownOpen(true)}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 cursor-pointer hover:border-primary-400 hover:bg-slate-100/70 transition-all"
              >
                <div className="flex items-center gap-2.5">
                  <Avatar name={selectedLead.fullName} size="sm" className="h-6 w-6 text-[10px]" />
                  <div>
                    <span className="block text-xs font-bold text-slate-900">{selectedLead.fullName}</span>
                    <span className="block text-[11px] text-slate-500">{selectedLead.email}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMemberDropdownOpen(true);
                  }}
                  className="text-xs text-primary-600 hover:underline cursor-pointer font-medium"
                >
                  {t('projects:newProjectModal.changeLead')}
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={memberSearch}
                  autoFocus={isMemberDropdownOpen && Boolean(selectedLead)}
                  onFocus={() => setIsMemberDropdownOpen(true)}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setIsMemberDropdownOpen(true);
                  }}
                  placeholder={t('projects:newProjectModal.searchMemberPlaceholder')}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                />
              </div>
            )}

            {isMemberDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsMemberDropdownOpen(false)}
                  aria-hidden
                />
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl shadow-slate-200/80 animate-slide-up">
                  {filteredUsers.length === 0 ? (
                    <p className="px-3 py-2 text-center text-xs text-slate-400">{t('projects:newProjectModal.noMembersFound')}</p>
                  ) : (
                    filteredUsers.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setLeadId(u.id);
                          setIsMemberDropdownOpen(false);
                          setMemberSearch('');
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-slate-50 cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar name={u.fullName} size="sm" className="h-6 w-6 text-[10px]" />
                          <div>
                            <p className="font-semibold text-slate-900">{u.fullName}</p>
                            <p className="text-[10px] text-slate-400">{u.email}</p>
                          </div>
                        </div>
                        {leadId === u.id && <CheckIcon className="h-4 w-4 text-emerald-600" />}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cụm nút hành động */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 mt-5">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('projects:newProjectModal.cancel')}
          </Button>
          <Button type="submit" isLoading={updateProject.isPending}>
            {t('projects:editProjectModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
