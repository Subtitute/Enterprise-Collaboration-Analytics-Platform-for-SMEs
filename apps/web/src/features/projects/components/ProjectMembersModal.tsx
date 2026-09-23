import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Dropdown } from '@/components/ui/Dropdown';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { SearchIcon, PlusIcon, TrashIcon, UsersIcon, CheckIcon, ChevronDownIcon } from '@/components/ui/Icons';
import { useOrgUsersQuery, useUserNameMap } from '@/hooks/useOrgUsers';
import { useDepartmentsQuery } from '@/features/admin/hooks';
import { canManageProjects } from '@/lib/utils';
import { useAddProjectMember, useProjectMembersQuery, useRemoveProjectMember } from '../hooks';
import { removeAssignee } from '../api';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/auth.store';
import { toast } from '@/stores/toast.store';
import type { Project, Task } from '@/types';

interface ProjectMembersModalProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  tasks?: Task[];
}

export function ProjectMembersModal({ open, onClose, project, tasks = [] }: ProjectMembersModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canManage = canManageProjects(currentUser?.roles);

  const { data: allUsers = [], isLoading: isUsersLoading } = useOrgUsersQuery({ enabled: open });
  const { data: departments = [] } = useDepartmentsQuery();
  const projectMembersQuery = useProjectMembersQuery(open ? project.id : undefined);
  const addMemberMutation = useAddProjectMember(project.id);
  const removeMemberMutation = useRemoveProjectMember(project.id);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserIdToAdd, setSelectedUserIdToAdd] = useState<string>('');
  const [userToRemove, setUserToRemove] = useState<{ id: string; name: string } | null>(null);

  const departmentMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of departments) map[d.id] = d.name;
    return map;
  }, [departments]);

  // 22/09/2026: "thanh vien du an" = hop cua nguoi phu trach (leadUserId), nguoi dang duoc giao
  // >=1 Task (TaskAssignee, qua prop `tasks`), va thanh vien duoc them THANG qua ProjectMember (du
  // lieu that tu server - thay localStorage truoc day, xem ProjectsService.addMember()).
  const memberIds = useMemo(() => {
    const memberSet = new Set<string>();
    if (project.leadUserId) memberSet.add(project.leadUserId);
    for (const task of tasks) {
      for (const assignee of task.assignees ?? []) {
        if (assignee.userId) memberSet.add(assignee.userId);
      }
    }
    for (const member of projectMembersQuery.data ?? []) memberSet.add(member.userId);
    return Array.from(memberSet);
  }, [project.leadUserId, tasks, projectMembersQuery.data]);

  // Danh sách thành viên đầy đủ thông tin
  const members = useMemo(() => {
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    return memberIds
      .map((id) => userMap.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u));
  }, [memberIds, allUsers]);

  // Đếm số task của từng thành viên trong dự án
  const taskCountByMember = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      for (const a of task.assignees ?? []) {
        counts[a.userId] = (counts[a.userId] || 0) + 1;
      }
    }
    return counts;
  }, [tasks]);

  // Thành viên có thể thêm vào dự án (chưa có trong dự án)
  const availableCandidates = useMemo(() => {
    const memberIdSet = new Set(memberIds);
    return allUsers.filter((u) => {
      if (memberIdSet.has(u.id)) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    });
  }, [allUsers, memberIds, searchQuery]);

  const selectedCandidate = allUsers.find((u) => u.id === selectedUserIdToAdd);

  function handleAddMember() {
    if (!selectedUserIdToAdd) return;
    const addedUser = allUsers.find((u) => u.id === selectedUserIdToAdd);
    addMemberMutation.mutate(selectedUserIdToAdd, {
      onSuccess: () => {
        toast.success(t('projects:membersModal.toast.memberAdded', { name: addedUser?.fullName ?? '' }));
        setSelectedUserIdToAdd('');
        setSearchQuery('');
      },
    });
  }

  function handleConfirmRemove() {
    if (!userToRemove) return;

    if (userToRemove.id === project.leadUserId) {
      toast.error(t('projects:membersModal.toast.cannotRemoveLead'));
      setUserToRemove(null);
      return;
    }

    const removedId = userToRemove.id;
    const removedName = userToRemove.name;
    removeMemberMutation.mutate(removedId, {
      onSuccess: () => {
        // Tu dong go cac task dang giao cho thanh vien nay trong du an - hanh vi cascade UX doc
        // lap voi ProjectMember (backend removeMember() KHONG dong cham TaskAssignee).
        const tasksWithUser = tasks.filter((t) => t.assignees?.some((a) => a.userId === removedId));
        if (tasksWithUser.length > 0) {
          Promise.allSettled(tasksWithUser.map((t) => removeAssignee(t.id, removedId))).then(() => {
            queryClient.invalidateQueries({ queryKey: ['tasks', project.id] });
          });
        }
        toast.success(t('projects:membersModal.toast.memberRemoved', { name: removedName }));
      },
    });
    setUserToRemove(null);
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        size="lg"
        title={
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200/60 shadow-2xs">
              <UsersIcon className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{t('projects:membersModal.title')}</h2>
                <Badge variant="default" className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 border-indigo-200/60">
                  {t('projects:membersModal.memberCount', { count: members.length })}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-sm mt-0.5 font-normal">{project.name}</p>
            </div>
          </div>
        }
      >
        <div className="space-y-4 py-1">
          {/* Cụm Thêm Thành Viên Mới (Chỉ hiển thị cho Admin / Manager) */}
          {canManage && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                {t('projects:membersModal.addMemberTitle')}
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Dropdown
                  align="left"
                  panelClassName="w-72 sm:w-80 p-2 rounded-2xl border border-slate-200/80 bg-white shadow-xl space-y-1.5"
                  trigger={({ open: isOpen, toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      className="flex-1 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-2xs transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-left min-h-[38px]"
                    >
                      {selectedCandidate ? (
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar name={selectedCandidate.fullName} size="sm" className="h-6 w-6 text-[10px]" />
                          <span className="truncate font-semibold text-slate-900">{selectedCandidate.fullName}</span>
                          <span className="text-[11px] text-slate-400 truncate">({selectedCandidate.email})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">{t('projects:membersModal.selectMemberPlaceholder')}</span>
                      )}
                      <ChevronDownIcon className={`h-4 w-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                  )}
                >
                  {({ close }) => (
                    <div className="space-y-2">
                      <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder={t('projects:membersModal.searchPlaceholder')}
                          className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-indigo-500"
                          autoFocus
                        />
                      </div>

                      <div className="max-h-52 overflow-y-auto space-y-0.5">
                        {availableCandidates.length === 0 ? (
                          <p className="py-4 text-center text-xs text-slate-400 italic">
                            {t('projects:membersModal.noAvailableCandidates')}
                          </p>
                        ) : (
                          availableCandidates.map((u) => {
                            const isSelected = u.id === selectedUserIdToAdd;
                            const deptName = u.departmentId ? departmentMap[u.departmentId] : null;

                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setSelectedUserIdToAdd(u.id);
                                  close();
                                }}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs transition-colors ${
                                  isSelected ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <Avatar name={u.fullName} size="sm" className="h-6 w-6 text-[10px]" />
                                  <div className="min-w-0">
                                    <p className="truncate font-medium">{u.fullName}</p>
                                    <p className="text-[10px] text-slate-400 truncate">
                                      {u.email} {deptName ? `• ${deptName}` : ''}
                                    </p>
                                  </div>
                                </div>
                                {isSelected && <CheckIcon className="h-3.5 w-3.5 text-indigo-600 shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </Dropdown>

                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedUserIdToAdd || addMemberMutation.isPending}
                  onClick={handleAddMember}
                  className="shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm active:scale-[0.98] font-semibold"
                >
                  <PlusIcon className="h-4 w-4 mr-1.5" />
                  <span>{t('projects:membersModal.addButton')}</span>
                </Button>
              </div>
            </div>
          )}

          {/* Danh Sách Thành Viên Hiện Tại */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {t('projects:membersModal.currentMembersTitle')}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {t('projects:membersModal.totalCount', { count: members.length })}
              </span>
            </div>

            {isUsersLoading || projectMembersQuery.isLoading ? (
              <div className="flex justify-center py-8">
                <Spinner size="sm" />
              </div>
            ) : members.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <UsersIcon className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-semibold text-slate-600">{t('projects:membersModal.emptyTitle')}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{t('projects:membersModal.emptyDescription')}</p>
              </div>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {members.map((m) => {
                  const isLead = m.id === project.leadUserId;
                  const deptName = m.departmentId ? departmentMap[m.departmentId] : null;
                  const taskCount = taskCountByMember[m.id] ?? 0;

                  return (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-xl border border-slate-200/70 bg-white hover:border-slate-300 transition-all shadow-2xs group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar name={m.fullName} size="md" className="h-9 w-9 text-xs shrink-0 ring-1 ring-slate-100" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 truncate" title={m.fullName}>
                              {m.fullName}
                            </span>
                            {isLead && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60 shadow-2xs">
                                {t('projects:membersModal.roles.lead')}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {m.email} {deptName ? `• ${deptName}` : ''}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {taskCount > 0 && (
                          <span className="text-[11px] font-medium text-slate-500 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/60">
                            {t('projects:membersModal.taskCount', { count: taskCount })}
                          </span>
                        )}

                        {canManage && (
                          <button
                            type="button"
                            onClick={() => {
                              if (isLead) {
                                toast.error(t('projects:membersModal.toast.cannotRemoveLead'));
                                return;
                              }
                              setUserToRemove({ id: m.id, name: m.fullName });
                            }}
                            title={isLead ? t('projects:membersModal.leadCannotBeRemoved') : t('projects:membersModal.removeMemberTooltip')}
                            disabled={isLead}
                            className={`p-1.5 rounded-lg text-xs transition-colors ${
                              isLead
                                ? 'text-slate-300 cursor-not-allowed opacity-40'
                                : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer active:scale-95'
                            }`}
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Modal xác nhận gỡ thành viên */}
      <ConfirmDialog
        open={Boolean(userToRemove)}
        onClose={() => setUserToRemove(null)}
        onConfirm={handleConfirmRemove}
        title={t('projects:membersModal.confirmRemoveTitle')}
        description={t('projects:membersModal.confirmRemoveDescription', { name: userToRemove?.name ?? '' })}
        confirmLabel={t('projects:membersModal.confirmRemoveButton')}
        danger
      />
    </>
  );
}

