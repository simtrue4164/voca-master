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
    <aside className="w-44 shrink-0 hidden md:block">
      <div className="bg-white rounded-2xl shadow-sm p-3 sticky top-[61px]">
        <div className="px-2 pb-3 mb-2 border-b border-[#f5f5f7]">
          <p className="text-[11px] text-[#6e6e73]">관리자</p>
          <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">{name}</p>
        </div>
        <nav className="space-y-0.5">
          {menus.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className={`block px-3 py-2 rounded-xl text-[13px] transition-colors ${
                pathname.startsWith(m.href)
                  ? 'bg-[#f5f5f7] text-[#1d1d1f] font-semibold'
                  : 'text-[#6e6e73] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]'
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
