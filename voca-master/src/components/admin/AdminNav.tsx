'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const allMenus = [
  { href: '/admin/dashboard', label: '대시보드', roles: ['admin_super', 'admin_branch', 'admin_class'] },
  { href: '/admin/branches', label: '지점 관리', roles: ['admin_super'] },
  { href: '/admin/classes', label: '반 관리', roles: ['admin_super', 'admin_branch'] },
  { href: '/admin/admins', label: '관리자 관리', roles: ['admin_super'] },
  { href: '/admin/students', label: '학생 관리', roles: ['admin_super', 'admin_branch', 'admin_class'] },
  { href: '/admin/progress', label: '학습 진도', roles: ['admin_super', 'admin_branch', 'admin_class'] },
  { href: '/admin/exams', label: '시험 관리', roles: ['admin_super', 'admin_branch', 'admin_class'] },
  { href: '/admin/vocabulary', label: '어휘 관리', roles: ['admin_super'] },
  { href: '/admin/counseling', label: '상담 관리', roles: ['admin_super', 'admin_branch', 'admin_class'] },
];

export default function AdminNav({ role, name }: { role: string; name: string }) {
  const pathname = usePathname();
  const menus = allMenus.filter((m) => m.roles.includes(role));

  return (
    <aside className="w-48 shrink-0 hidden md:block">
      <div className="bg-white rounded-xl border border-gray-200 p-3 sticky top-6">
        <div className="px-2 pb-3 mb-2 border-b border-gray-100">
          <p className="text-xs text-gray-400">관리자</p>
          <p className="text-sm font-semibold text-gray-800 truncate">{name}</p>
        </div>
        <nav className="space-y-0.5">
          {menus.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname.startsWith(m.href)
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {m.label}
            </Link>
          ))}
        </nav>
      </div>
    </aside>
  );
}
