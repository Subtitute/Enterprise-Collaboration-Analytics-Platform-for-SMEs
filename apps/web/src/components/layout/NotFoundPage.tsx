import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center">
      <p className="text-6xl font-bold text-primary-600">404</p>
      <p className="text-lg font-semibold text-slate-900">Không tìm thấy trang</p>
      <p className="max-w-sm text-sm text-slate-500">Trang bạn truy cập không tồn tại hoặc đã bị di chuyển.</p>
      <Link to="/dashboard">
        <Button className="mt-2">Về trang Dashboard</Button>
      </Link>
    </div>
  );
}
