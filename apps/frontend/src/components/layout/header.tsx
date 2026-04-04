'use client';

import { Bell, ChevronDown } from 'lucide-react';

interface User {
  firstName: string;
  lastName: string;
  role: string;
  email: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Administrateur',
  MANAGER: 'Manager',
  AGENT: 'Agent',
};

export function Header({ user }: { user: User }) {
  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 shrink-0">
      {/* Left: breadcrumb placeholder */}
      <div className="text-sm text-gray-500">Bienvenue, {user.firstName}</div>

      {/* Right: actions */}
      <div className="flex items-center gap-4">
        <button className="relative text-gray-400 hover:text-gray-600 transition-colors">
          <Bell size={20} />
        </button>

        <div className="flex items-center gap-2 cursor-pointer group">
          <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-semibold">
              {user.firstName[0]}{user.lastName[0]}
            </span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-none">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">{ROLE_LABELS[user.role] ?? user.role}</p>
          </div>
          <ChevronDown size={14} className="text-gray-400" />
        </div>
      </div>
    </header>
  );
}
