'use client';

import React from 'react';
import { AppSidebar } from './AppSidebar';

type Props = {
  children: React.ReactNode;
};

export function AppShell({ children }: Props) {
  return (
    <div className="min-h-screen bg-[#FBFBF9] dark:bg-[#0B0F19] text-[#0F172A] dark:text-[#F8FAFC] flex flex-col md:flex-row font-sans selection:bg-[#0D9488]/20 selection:text-[#0F172A] dark:selection:text-white">
      {/* Sidebar Navigation */}
      <AppSidebar />

      {/* Main Study Workspace Area */}
      <main
        role="main"
        className="flex-1 min-w-0 overflow-y-auto"
      >
        <div className="max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
