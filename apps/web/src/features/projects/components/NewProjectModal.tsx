import { useState, useRef, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Textarea } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import { Avatar } from '@/components/ui/Avatar';
import { SearchIcon, CheckIcon, XIcon, PlusIcon } from '@/components/ui/Icons';
import { useOrgUsersQuery } from '@/hooks/useOrgUsers';
import { useCreateProject } from '../hooks';
import { addProjectMember } from '../api';

export function NewProjectModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const nameInputRef = useRef<HTMLInputElement>(null);
  const usersQuery = useOrgUsersQuery({ enabled: open });

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [leadId, setLeadId] = useState<string>('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [isMemberDropdownOpen, setIsMemberDropdownOpen] = useState(false);
  const [isAddMembersDropdownOpen, setIsAddMembersDropdownOpen] = useState(false);
  const [teamMemberSearch, setTeamMemberSearch] = useState('');
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

  // Tự động đưa Người phụ trách (leadId) vào danh sách thành viên và khóa cứng
  useEffect(() => {
    if (leadId && !memberIds.includes(leadId)) {
      setMemberIds((prev) => [leadId, ...prev.filter((id) => id !== leadId)]);
    }
  }, [leadId]);

  const allUsers = usersQuery.data ?? [];
  const selectedLead = allUsers.find((u) => u.id === leadId);

  const filteredUsers = allUsers.filter((u) =>
    u.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  const filteredTeamCandidates = allUsers.filter((u) =>
    u.fullName.toLowerCase().includes(teamMemberSearch.toLowerCase()) ||
    u.email.toLowerCase().includes(teamMemberSearch.toLowerCase())
  );

  function reset() {
    setName('');
    setDescription('');
    setDueDate('');
    setPriority('MEDIUM');
    setLeadId('');
    setMemberIds([]);
    setMemberSearch('');
    setTeamMemberSearch('');
    setIsMemberDropdownOpen(false);
    setIsAddMembersDropdownOpen(false);
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
        priority,
        leadUserId: leadId || undefined,
      },
      {
        onSuccess: async (newProject) => {
          if (newProject?.id) {
            try {
              // Thêm các thành viên tham gia vào dự án
              const toAdd = Array.from(new Set(memberIds.filter(Boolean)));
              if (toAdd.length > 0) {
                await Promise.allSettled(toAdd.map((uId) => addProjectMember(newProject.id, uId)));
              }
            } catch {
              // ignore
            }

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
    { value: 'LOW', label: t('projects:newProjectModal.priorities.LOW'), color: 'text-slate-600 bg-slate-50 border-slate-200' },
    { value: 'MEDIUM', label: t('projects:newProjectModal.priorities.MEDIUM'), color: 'text-blue-700 bg-blue-50 border-blue-200' },
    { value: 'HIGH', label: t('projects:newProjectModal.priorities.HIGH'), color: 'text-amber-700 bg-amber-50 border-amber-200' },
    { value: 'URGENT', label: t('projects:newProjectModal.priorities.URGENT'), color: 'text-rose-700 bg-rose-50 border-rose-200' },
  ] as const;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      // 26/08/2026: modal nay cung o lai trong DOM (cha bat/tat qua prop `open`), createProject.mutate()
      // ben tren goi onSuccess: (...) => { ...; handleClose(); } - giong dung loi da sua hom qua o
      // 4 modal khac (vd DepartmentModal.tsx): neu dong+mo lai modal trong luc mutation cu con dang
      // bay, onSuccess cu se dong nham phien ban modal moi. Chan bang prop dung chung cua Modal.tsx.
      preventCloseWhilePending={createProject.isPending}
      title={t('projects:newProjectModal.title')}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Tên dự án (Bắt buộc & Auto-focus) */}
        <FormField label={t('projects:newProjectModal.nameLabel')} htmlFor="project-name" error={error} required>
          <Input
            ref={nameInputRef}
            id="project-name"
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
        <FormField label={t('projects:newProjectModal.descriptionLabel')} htmlFor="project-description">
          <Textarea
            id="project-description"
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
            <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="project-due-date">
              {t('projects:newProjectModal.dueDateLabel')}
            </label>
            <DatePicker id="project-due-date" value={dueDate} onChange={setDueDate} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700">
                {t('projects:newProjectModal.priorityLabel')}
              </label>
              {/* 26/08/2026 (fix code review, loi MINOR - Fix 4): da xoa nhanh {!priority && ...}
                  hien thong bao "bat buoc chon do uu tien" o day - khong bao gio render duoc vi
                  `priority` duoc khoi tao = 'MEDIUM' va chi co the nhan 1 trong 4 gia tri enum
                  (khong bao gio rong/falsy), dead code. */}
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

        {/* Người phụ trách (Hiển thị danh sách khi đổi thay vì xóa đi) */}
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

        {/* Thành viên tham gia (Multi-select, Lead bị khóa cứng) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-semibold text-slate-700">
              {t('projects:newProjectModal.membersLabel')}
            </label>
            <span className="text-[11px] text-slate-400">
              {memberIds.length} {t('projects:projectCard.memberCount', { count: memberIds.length })}
            </span>
          </div>

          {/* Danh sách thành viên đã chọn dạng pill/tag */}
          <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px] p-1.5 rounded-lg border border-slate-200 bg-slate-50/50">
            {memberIds.length === 0 ? (
              <span className="text-xs text-slate-400 italic px-1 self-center">
                {t('projects:newProjectModal.searchMembersPlaceholder')}
              </span>
            ) : (
              memberIds.map((mId) => {
                const u = allUsers.find((user) => user.id === mId);
                if (!u) return null;
                const isLead = mId === leadId;

                return (
                  <span
                    key={mId}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                      isLead
                        ? 'bg-indigo-50 text-indigo-700 border-indigo-200 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 shadow-2xs'
                    }`}
                  >
                    <Avatar name={u.fullName} size="sm" className="h-4 w-4 text-[8px]" />
                    <span className="truncate max-w-[120px]">{u.fullName}</span>
                    {isLead ? (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-100/70 px-1 rounded"
                        title={t('projects:newProjectModal.leadLockedHint')}
                      >
                        {t('projects:projectCard.leadLabel')}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setMemberIds((prev) => prev.filter((id) => id !== mId))}
                        className="text-slate-400 hover:text-rose-600 cursor-pointer ml-0.5"
                        aria-label={t('common:actions.cancel')}
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                );
              })
            )}
          </div>

          {/* Nút dropdown thêm thành viên */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsAddMembersDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-primary-400 hover:bg-slate-50 transition-colors cursor-pointer w-full justify-center"
            >
              <PlusIcon className="h-3.5 w-3.5 text-slate-400" />
              <span>{t('projects:newProjectModal.searchMembersPlaceholder')}</span>
            </button>

            {isAddMembersDropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsAddMembersDropdownOpen(false)}
                  aria-hidden
                />
                <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/80 animate-slide-up">
                  <div className="relative mb-2">
                    <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={teamMemberSearch}
                      onChange={(e) => setTeamMemberSearch(e.target.value)}
                      placeholder={t('projects:newProjectModal.searchMembersPlaceholder')}
                      autoFocus
                      className="h-8 w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-2.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-primary-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                  {filteredTeamCandidates.length === 0 ? (
                    <p className="px-2 py-2 text-center text-xs text-slate-400">{t('projects:newProjectModal.noMembersFound')}</p>
                  ) : (
                    filteredTeamCandidates.map((u) => {
                      const isSelected = memberIds.includes(u.id);
                      const isLead = u.id === leadId;

                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            if (isLead) return; // Khóa cứng người phụ trách
                            if (isSelected) {
                              setMemberIds((prev) => prev.filter((id) => id !== u.id));
                            } else {
                              setMemberIds((prev) => [...prev, u.id]);
                            }
                          }}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-slate-50 cursor-pointer ${
                            isSelected ? 'bg-primary-50/50' : ''
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar name={u.fullName} size="sm" className="h-6 w-6 text-[10px]" />
                            <div className="min-w-0 truncate">
                              <p className="font-semibold text-slate-900 truncate">{u.fullName}</p>
                              <p className="text-[10px] text-slate-400 truncate">{u.email}</p>
                            </div>
                          </div>
                          {isLead ? (
                            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                              {t('projects:projectCard.leadLabel')}
                            </span>
                          ) : isSelected ? (
                            <CheckIcon className="h-4 w-4 text-emerald-600 shrink-0" />
                          ) : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Phân cấp rõ ràng nhóm nút hành động */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3 mt-5">
          {/* 26/08/2026: them disabled={createProject.isPending} - nut Huy nay truoc do goi thang
              handleClose khong dieu kien, la 1 duong dong khong bi chan boi preventCloseWhilePending
              (prop do chi chan X/Escape/backdrop trong Modal.tsx, khong bao trum nut tu viet trong
              modal con) - mirror dung disabled đã co san o DepartmentModal.tsx/UploadModal.tsx. */}
          <Button type="button" variant="outline" onClick={handleClose} disabled={createProject.isPending}>
            {t('projects:newProjectModal.cancel')}
          </Button>
          <Button type="submit" isLoading={createProject.isPending}>
            {t('projects:newProjectModal.submit')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
