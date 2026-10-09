'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  BookOpen,
  MessageSquare,
  Settings,
  Menu,
  X,
  GraduationCap,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { fetchSystemStatus } from '../lib/api';
import type { SystemStatusDTO } from '@lectern/shared';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: Home },
  { label: 'My Lectures', href: '/lectures', icon: BookOpen },
  { label: 'Ask Lectern', href: '/ask', icon: MessageSquare },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatusDTO | null>(null);

  useEffect(() => {
    fetchSystemStatus().then(setSystemStatus).catch(() => {});
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const isReady = systemStatus?.whisperReady !== false && systemStatus?.offline !== false;

  return (
    <>
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-[#FFFFFF] dark:bg-[#131B2E] border-b border-[#E5E5DF] dark:border-[#1E293B] sticky top-0 z-40">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0F172A] text-white flex items-center justify-center font-bold">
            <GraduationCap className="w-4 h-4" />
          </div>
          <span className="font-semibold text-base text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
            Lectern
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-expanded={mobileMenuOpen}
          aria-label="Toggle navigation menu"
          className="p-2 rounded-md text-[#64748B] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F4F4F0] dark:hover:bg-[#1E293B] transition-colors"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Desktop Persistent + Mobile Drawer) */}
      <aside
        aria-label="Primary navigation"
        className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-[#FFFFFF] dark:bg-[#131B2E] border-r border-[#E5E5DF] dark:border-[#1E293B] flex flex-col justify-between z-50 transition-transform duration-200 ease-in-out ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top: Logo & Nav items */}
        <div className="p-4 space-y-6">
          {/* Logo & Academic Title */}
          <Link href="/" className="flex items-center gap-3 px-2 py-1.5 group">
            <div className="w-8 h-8 rounded-lg bg-[#0F172A] dark:bg-[#F8FAFC] text-white dark:text-[#0F172A] flex items-center justify-center shadow-xs">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <div className="font-semibold text-base text-[#0F172A] dark:text-[#F8FAFC] tracking-tight">
                Lectern
              </div>
              <div className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-normal">
                Offline lecture assistant
              </div>
            </div>
          </Link>

          {/* Navigation Items */}
          <nav role="navigation" className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#F4F4F0] dark:bg-[#1E293B] text-[#0F172A] dark:text-white font-semibold'
                      : 'text-[#64748B] dark:text-[#94A3B8] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#FAF9F5] dark:hover:bg-[#182238]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive
                          ? 'text-[#0F172A] dark:text-white'
                          : 'text-[#64748B] dark:text-[#94A3B8]'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0D9488]" aria-hidden="true" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom: Persistent Local-Processing & Offline Status */}
        <div className="p-3 border-t border-[#E5E5DF] dark:border-[#1E293B]">
          <Link
            href="/settings"
            title="View local system diagnostics & model availability"
            className="w-full flex items-center justify-between p-2.5 rounded-lg bg-[#FAF9F5] dark:bg-[#19233C] border border-[#EAEAE5] dark:border-[#1E293B] hover:border-[#CBD5E1] dark:hover:border-slate-700 transition-colors text-left group"
          >
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isReady ? 'bg-[#0D9488]' : 'bg-amber-500'
                  }`}
                  aria-hidden="true"
                />
                <span className="text-xs font-semibold text-[#0F172A] dark:text-white truncate">
                  {isReady ? 'Offline-ready' : 'Local AI paused'}
                </span>
              </div>
              <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8] truncate pl-4">
                {isReady ? 'Processing locally' : 'Check service status'}
              </p>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#0F172A] dark:group-hover:text-white transition-colors shrink-0" />
          </Link>
        </div>
      </aside>
    </>
  );
}
