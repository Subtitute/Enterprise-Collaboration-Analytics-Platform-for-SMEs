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
import { useCreateProject } from '../hooks';

export function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const usersQuery = useOrgUsersQuery({ enabled: open });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [leadId, setLeadId] = useState<string>('');
  const [memberSearch, setMemberSearch] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [error, setError] = useState('');

  const createProject = useCreateProject();

  // Tự động focus vào ô Tên dự án khi mở modal
  useEffect(() => {
    if (open) {
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [open]);

  const allUsers = usersQuery.data ?? [];
  const selectedLead = allUsers.find((u) => u.id === leadId);

  const filteredUsers = allUsers.filter((u) =>
    u.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  function reset() {
    setName('');
    setDescription('');
    setDueDate('');
    setPriority('MEDIUM');
    setLeadId('');
    setMemberSearch('');
    setIsMemberDropdownOpen(false);
    setError('');
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t('projects:newProjectModal.nameRequired'));
      nameInputRef.current?.focus();
      return;
    }
    createProject.mutate(
      {
        name: name.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        // 26/08/2026 (fix code review, loi MAJOR - Fix 3): gui priority/leadUserId THANG len server
        // (xem project.entity.ts/create-project.dto.ts, project-task-service) thay vi chi luu vao
        // localStorage['ec_projects_metadata'] nhu truoc - gia tri nay truoc day CHI hien thi duoc
        // tren dung trinh duyet da tao du an, nguoi dung/thiet bi khac khong bao gio thay.
        priority,
        leadUserId: leadId || undefined,
      },
      {
        onSuccess: (newProject) => {
          if (newProject?.id) {
            try {
              // Đưa ID dự án mới lên đầu danh sách sắp xếp
              const savedOrder: string[] = JSON.parse(localStorage.getItem('ec_projects_custom_order') || '[]');
              const updatedOrder = [newProject.id, ...savedOrder.filter((id) => id !== newProject.id)];
              localStorage.setItem('ec_projects_custom_order', JSON.stringify(updatedOrder));
            } catch {
              // ignore
            }
          }
          handleClose();
        },
      },
    );
  }

  const PRIORITY_OPTIONS = [
    { value: 'LOW', label: t('projects:newProjectModal.priorities.LOW', 'Thấp') },
    { value: 'MEDIUM', label: t('projects:newProjectModal.priorities.MEDIUM', 'Trung bình') },
    { value: 'HIGH', label: t('projects:newProjectModal.priorities.HIGH', 'Cao') },
    { value: 'URGENT', label: t('projects:newProjectModal.priorities.URGENT', 'Khẩn cấp') },
  ] as const;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      preventCloseWhilePending={createProject.isPending}
      title={t('projects:newProjectModal.title', 'Tạo dự án mới')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Tên dự án (Bắt buộc & Auto-focus) */}
        <div>
          <label className="block text-[13px] leading-[20px] font-medium text-text-secondary mb-1.5" htmlFor="project-name">
            {t('projects:newProjectModal.nameLabel', 'Tên dự án')} <span className="text-text-error ml-0.5">*</span>
          </label>
          <input
            ref={nameInputRef}
            id="project-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            placeholder={t('projects:newProjectModal.namePlaceholder', 'Ví dụ: Ra mắt website mới')}
            className={`h-9 w-full rounded-radius-sm border px-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 ${
              error ? 'border-text-error focus:border-text-error focus:ring-text-error/20' : 'border-border-strong bg-white focus:border-accent focus:ring-accent'
            }`}
          />
          {error && <p className="mt-1 text-[11px] font-medium text-text-error">{error}</p>}
        </div>

        {/* Mô tả dự án */}
        <div>
          <label className="block text-[13px] leading-[20px] font-medium text-text-secondary mb-1.5" htmlFor="project-description">
            {t('projects:newProjectModal.descriptionLabel', 'Mô tả')}
          </label>
          <textarea
            id="project-description"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('projects:newProjectModal.descriptionPlaceholder', 'Mục tiêu, phạm vi công việc của dự án...')}
            className="w-full rounded-radius-sm border border-border-strong bg-white p-2.5 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent min-h-[80px] resize-y"
          />
        </div>

        {/* Hàng 2 cột: Hạn hoàn thành & Độ ưu tiên (60%/40%, gap 16, mobile stack) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
          <div>
            <label className="block text-[13px] leading-[20px] font-medium text-text-secondary mb-1.5" htmlFor="project-due-date">
              {t('projects:newProjectModal.dueDateLabel', 'Hạn hoàn thành')}
            </label>
            <DatePicker id="project-due-date" value={dueDate} onChange={setDueDate} />
          </div>

          <div>
            <label className="block text-[13px] leading-[20px] font-medium text-text-secondary mb-1.5">
              {t('projects:newProjectModal.priorityLabel', 'Độ ưu tiên')}
            </label>
            {/* §2.2 Segmented Control: Nền bg-subtle, p-0.5 (2px), radius radius-md 6px, h-9 */}
            <div className="flex h-9 w-full items-center rounded-radius-md bg-bg-subtle p-0.5 gap-0.5">
              {PRIORITY_OPTIONS.map((opt) => {
                const isSelected = priority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setPriority(opt.value)}
                    className={`flex-1 h-8 flex items-center justify-center rounded-radius-sm px-1 text-[11px] whitespace-nowrap leading-none transition-colors cursor-pointer select-none ${
                      isSelected
                        ? 'bg-white border border-border-subtle text-[#1C1B1A] font-semibold shadow-xs'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-canvas font-medium'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Người phụ trách (§2.5: Searchable select) */}
        <div className="relative">
          <label className="block text-[13px] leading-[20px] font-medium text-text-secondary mb-1.5">
            {t('projects:newProjectModal.leadLabel', 'Người phụ trách')}
          </label>

          <div className="relative">
            {selectedLead && !isMemberDropdownOpen ? (
              <div
                onClick={() => setIsMemberDropdownOpen(true)}
                className="flex items-center justify-between rounded-radius-sm border border-border-strong bg-white px-3 py-1.5 cursor-pointer hover:border-accent hover:bg-bg-subtle transition-all h-9"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar name={selectedLead.fullName} size="sm" className="h-5 w-5 shrink-0 text-[10px] rounded-full bg-accent-soft text-accent font-medium" />
                  <span className="truncate text-[13px] font-medium text-text-primary">{selectedLead.fullName}</span>
                  <span className="hidden sm:inline text-[11px] text-text-tertiary">({selectedLead.email})</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsMemberDropdownOpen(true);
                  }}
                  className="text-[12px] text-accent hover:underline cursor-pointer font-medium shrink-0 ml-2"
                >
                  {t('projects:newProjectModal.changeLead', 'Đổi')}
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
                <input
                  type="text"
                  value={memberSearch}
                  autoFocus={isMemberDropdownOpen && Boolean(selectedLead)}
                  onFocus={() => setIsMemberDropdownOpen(true)}
                  onChange={(e) => {
                    setMemberSearch(e.target.value);
                    setIsMemberDropdownOpen(true);
                  }}
                  placeholder={t('projects:newProjectModal.searchMemberPlaceholder', 'Tìm và chọn người phụ trách...')}
                  className="h-9 w-full rounded-radius-sm border border-border-strong bg-white pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
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
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-radius-md border border-border-subtle bg-white p-1 shadow-md popover-scrollbar animate-slide-up">
                  {filteredUsers.length === 0 ? (
                    <p className="px-3 py-2 text-center text-[12px] text-text-tertiary">{t('projects:newProjectModal.noMembersFound', 'Không tìm thấy thành viên')}</p>
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
                        className="flex w-full items-center justify-between rounded-radius-sm px-2.5 py-2 text-left text-[13px] transition-colors hover:bg-bg-subtle cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar name={u.fullName} size="sm" className="h-6 w-6 shrink-0 text-[10px] rounded-full bg-accent-soft text-accent font-medium" />
                          <div className="min-w-0">
                            <p className="font-medium text-text-primary truncate">{u.fullName}</p>
                            <p className="text-[11px] text-text-tertiary truncate">{u.email}</p>
                          </div>
                        </div>
                        {leadId === u.id && <CheckIcon className="h-4 w-4 text-accent shrink-0 ml-2" />}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer nút hành động: Căn phải, gap 8. Hủy = Secondary, Tạo dự án = Primary Ink */}
        <div className="flex items-center justify-end gap-2 border-t border-border-subtle pt-4 mt-6">
          <button
            type="button"
            onClick={handleClose}
            disabled={createProject.isPending}
            className="h-9 px-3.5 rounded-radius-md border border-border-strong bg-white text-[13px] font-medium text-text-primary hover:bg-bg-subtle transition-colors cursor-pointer disabled:opacity-50"
          >
            {t('projects:newProjectModal.cancel', 'Hủy')}
          </button>
          <button
            type="submit"
            disabled={createProject.isPending}
            className="h-9 px-3.5 rounded-radius-md bg-[#1C1B1A] text-[13px] font-medium text-white hover:bg-[#2E2C29] transition-colors cursor-pointer disabled:opacity-50"
          >
            {createProject.isPending ? t('common:actions.processing', 'Đang xử lý...') : t('projects:newProjectModal.submit', 'Tạo dự án')}
          </button>
        </div>
      </form>
    </Modal>
  );
}
