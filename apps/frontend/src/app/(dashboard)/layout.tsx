'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '@/components/layout/sidebar';
import { ChatWidget } from '@/components/chatbot/ChatWidget';
import { ManagerChatWidget } from '@/components/chat/ManagerChatWidget';
import { Header } from '@/components/layout/header';
import { useAuthStore } from '@/stores/auth.store';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import { AgentKeepAlive } from '@/components/layout/AgentKeepAlive';
import { usePermissionsStore } from '@/stores/permissions.store';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const fetchPerms = usePermissionsStore(s => s.fetch);
  const resetPerms = usePermissionsStore(s => s.reset);

  useEffect(() => {
    if (!isAuthenticated) {
      resetPerms();
      router.replace('/login');
    }
  }, [isAuthenticated, router, resetPerms]);

  useEffect(() => {
    if (isAuthenticated && user) fetchPerms();
  }, [isAuthenticated, user?.id, fetchPerms]);

  if (!isAuthenticated || !user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <AgentKeepAlive />
      <Sidebar role={user.role} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto p-6">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
        <ChatWidget />
        {(user.role === 'ADMIN' || user.role === 'MANAGER') && (
          <ManagerChatWidget
            userId={user.id}
            tenantId={user.tenantId}
            role={user.role}
            name={`${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email}
          />
        )}
      </div>
    </div>
  );
}
