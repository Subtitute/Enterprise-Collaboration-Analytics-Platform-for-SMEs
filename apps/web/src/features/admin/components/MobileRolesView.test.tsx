// 27/10/2026 - Bổ sung unit test cho Việc 5.1 & 5.2
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileRolesView } from './MobileRolesView';
import type { RoleWithPermissions, Permission } from '@/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) => {
      if (key === 'admin:roles.orgAdmin') return 'Quản trị viên tối cao';
      if (key === 'admin:roles.manager') return 'Quản lý';
      if (key === 'admin:roles.employee') return 'Nhân viên';
      if (key === 'admin:rolesPermissionsPage.lockedNotice') return 'Toàn quyền';
      if (key === 'admin:rolesPermissionsPage.selectAll') return 'Chọn tất cả';
      if (key === 'admin:rolesPermissionsPage.deselectAll') return 'Bỏ chọn tất cả';
      if (key === 'admin:rolesPermissionsPage.permissions.product_view') return 'Xem sản phẩm & danh mục';
      if (key === 'admin:rolesPermissionsPage.permissions.message_send') return 'Gửi tin nhắn nội bộ';
      return key;
    },
  }),
}));

describe('MobileRolesView - Quản lý phân quyền trên Mobile', () => {
  const roles: RoleWithPermissions[] = [
    {
      id: 'role-admin',
      name: 'Org Admin',
      permissionKeys: ['product:view', 'message:send'],
    },
    {
      id: 'role-manager',
      name: 'Manager',
      permissionKeys: ['product:view'],
    },
  ];

  const groupedModules = [
    {
      key: 'inventory',
      name: 'Sản phẩm & Kho',
      permissions: [
        {
          key: 'product:view',
          name: 'Xem sản phẩm & danh mục',
          module: 'inventory',
          description: 'Xem sản phẩm',
        } as Permission,
      ],
    },
    {
      key: 'message',
      name: 'Nhắn tin & Trợ lý AI',
      permissions: [
        {
          key: 'message:send',
          name: 'Gửi tin nhắn nội bộ',
          module: 'message',
          description: 'Gửi tin nhắn',
        } as Permission,
      ],
    },
  ];

  it('1. Render đầy đủ các tab vai trò và tự động chọn vai trò có thể chỉnh sửa', () => {
    render(
      <MobileRolesView
        roles={roles}
        groupedModules={groupedModules}
        isPending={false}
        onTogglePermission={vi.fn()}
        onToggleModule={vi.fn()}
      />,
    );

    expect(screen.getByText('Quản trị viên tối cao')).toBeInTheDocument();
    expect(screen.getAllByText('Quản lý').length).toBeGreaterThan(0);
  });

  it('2. Hiển thị đủ nhóm "Sản phẩm & Kho" và "Nhắn tin & Trợ lý AI"', () => {
    render(
      <MobileRolesView
        roles={roles}
        groupedModules={groupedModules}
        isPending={false}
        onTogglePermission={vi.fn()}
        onToggleModule={vi.fn()}
      />,
    );

    expect(screen.getByText('Sản phẩm & Kho')).toBeInTheDocument();
    expect(screen.getByText('Nhắn tin & Trợ lý AI')).toBeInTheDocument();
  });

  it('3. Gọi onTogglePermission khi click vào hàng quyền của vai trò tùy chỉnh', () => {
    const handleToggle = vi.fn();
    render(
      <MobileRolesView
        roles={roles}
        groupedModules={groupedModules}
        isPending={false}
        onTogglePermission={handleToggle}
        onToggleModule={vi.fn()}
      />,
    );

    // Click vào quyền message:send
    const permRow = screen.getByText('Gửi tin nhắn nội bộ');
    fireEvent.click(permRow);

    expect(handleToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'role-manager' }), 'message:send');
  });

  it('4. Khóa an toàn (Safety Lock): Vai trò Org Admin không cho phép toggle và hiển thị biểu tượng khóa', () => {
    const handleToggle = vi.fn();
    render(
      <MobileRolesView
        roles={roles}
        groupedModules={groupedModules}
        isPending={false}
        onTogglePermission={handleToggle}
        onToggleModule={vi.fn()}
      />,
    );

    // Chuyển sang tab Org Admin
    fireEvent.click(screen.getByText('Quản trị viên tối cao'));

    expect(screen.getByText('Toàn quyền')).toBeInTheDocument();

    // Click vào quyền
    const permRow = screen.getByText('Xem sản phẩm & danh mục');
    fireEvent.click(permRow);

    expect(handleToggle).not.toHaveBeenCalled();
  });
});
