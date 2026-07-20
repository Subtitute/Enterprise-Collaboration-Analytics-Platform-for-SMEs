import { useState } from 'react';
import type { FormEvent } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { FormField, Input, Select, Label } from '@/components/ui/Input';
import { useDepartmentsQuery, useInviteUser, useRolesQuery } from '../hooks';
import { RoleCheckboxList } from './RoleCheckboxList';

export function InviteMemberModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [initialPassword, setInitialPassword] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [roleIds, setRoleIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const departmentsQuery = useDepartmentsQuery();
  const rolesQuery = useRolesQuery();
  const inviteUser = useInviteUser();

  function reset() {
    setEmail('');
    setFullName('');
    setInitialPassword('');
    setDepartmentId('');
    setRoleIds([]);
    setErrors({});
  }

  function handleClose() {
    reset();
    onClose();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = 'Vui lòng nhập email';
    if (!fullName.trim()) next.fullName = 'Vui lòng nhập họ tên';
    if (!initialPassword || initialPassword.length < 8) next.initialPassword = 'Mật khẩu tối thiểu 8 ký tự';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    inviteUser.mutate(
      {
        email: email.trim(),
        fullName: fullName.trim(),
        initialPassword,
        departmentId: departmentId || undefined,
        roleIds: roleIds.length > 0 ? roleIds : undefined,
      },
      { onSuccess: handleClose },
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Mời thành viên mới">
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label="Email" htmlFor="invite-email" error={errors.email} required>
          <Input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ten@congty.com" />
        </FormField>
        <FormField label="Họ và tên" htmlFor="invite-fullname" error={errors.fullName} required>
          <Input id="invite-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nguyễn Văn A" />
        </FormField>
        <FormField
          label="Mật khẩu ban đầu"
          htmlFor="invite-password"
          error={errors.initialPassword}
          hint="Thành viên nên đổi lại mật khẩu sau lần đăng nhập đầu tiên"
          required
        >
          <Input
            id="invite-password"
            type="text"
            value={initialPassword}
            onChange={(e) => setInitialPassword(e.target.value)}
            placeholder="Tối thiểu 8 ký tự"
          />
        </FormField>
        <FormField label="Phòng ban" htmlFor="invite-department">
          <Select id="invite-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">— Không thuộc phòng ban —</option>
            {(departmentsQuery.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div>
          <Label>Vai trò</Label>
          <RoleCheckboxList roles={rolesQuery.data ?? []} selectedIds={roleIds} onChange={setRoleIds} />
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={handleClose}>
            Hủy
          </Button>
          <Button type="submit" isLoading={inviteUser.isPending}>
            Gửi lời mời
          </Button>
        </div>
      </form>
    </Modal>
  );
}
