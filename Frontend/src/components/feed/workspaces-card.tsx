'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useTenantStore, getTenantSlug } from '@/store/tenant-store';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Building2,
  ChevronRight,
  Shield,
  Crown,
  Users,
  Briefcase,
  ArrowUpRight,
  Plus,
  Sparkles,
} from 'lucide-react';
import { authApi, Tenant, TenantMembership } from '@/lib/api';

// Engine badge colors
const ENGINE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  odoo: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
  erpnext: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  default: { bg: 'bg-white/10', text: 'text-white/60', border: 'border-white/20' },
};

// Role badge config
const ROLE_CONFIG: Record<string, { icon: typeof Shield; color: string; label: string }> = {
  ADMIN: { icon: Crown, color: 'text-yellow-400', label: 'Admin' },
  MANAGER: { icon: Briefcase, color: 'text-purple-400', label: 'Manager' },
  CASHIER: { icon: Users, color: 'text-emerald-400', label: 'Cashier' },
  VIEWER: { icon: Users, color: 'text-white/50', label: 'Viewer' },
  MEMBER: { icon: Users, color: 'text-blue-400', label: 'Member' },
};

interface WorkspaceItemProps {
  tenant: Tenant;
  isActive?: boolean;
  role?: string;
  onClick: () => void;
}

function WorkspaceItem({ tenant, isActive, role = 'MEMBER', onClick }: WorkspaceItemProps) {
  const engineColor = ENGINE_COLORS[tenant.engine || 'default'] || ENGINE_COLORS.default;
  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.MEMBER;
  const RoleIcon = roleConfig.icon;

  return (
    <button
      onClick={onClick}
      className="w-full group relative"
    >
      {/* Hover glow effect */}
      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-cyan-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-300" />

      <div className={`
        relative flex items-center gap-4 p-4 rounded-xl transition-all duration-300
        ${isActive
          ? 'bg-gradient-to-r from-cyan-500/20 to-purple-500/20 border border-cyan-500/30'
          : 'bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20'
        }
      `}>
        {/* Tenant Avatar */}
        <div className={`
          h-12 w-12 rounded-xl flex items-center justify-center text-lg font-bold shrink-0
          ${isActive
            ? 'bg-gradient-to-br from-cyan-500 to-purple-600 text-white'
            : 'bg-white/10 text-white/70 group-hover:bg-white/20'
          }
        `}>
          {tenant.name.charAt(0)}
        </div>

        {/* Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`font-semibold truncate ${isActive ? 'text-white' : 'text-white/90'}`}>
              {tenant.name}
            </span>
            {isActive && (
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Role Badge */}
            <div className={`flex items-center gap-1 ${roleConfig.color}`}>
              <RoleIcon className="h-3 w-3" />
              <span className="text-xs font-medium">{roleConfig.label}</span>
            </div>

            {/* Engine Badge */}
            {tenant.engine && (
              <Badge
                variant="outline"
                className={`text-xs px-1.5 py-0 h-5 ${engineColor.bg} ${engineColor.text} ${engineColor.border}`}
              >
                {tenant.engine}
              </Badge>
            )}

            {/* Tenant Code */}
            <span className="text-xs text-white/30 font-mono">{tenant.code}</span>
          </div>
        </div>

        {/* Arrow */}
        <ChevronRight className={`
          h-5 w-5 shrink-0 transition-all duration-300
          ${isActive ? 'text-cyan-400' : 'text-white/30 group-hover:text-white/60 group-hover:translate-x-1'}
        `} />
      </div>
    </button>
  );
}

export function WorkspacesCard() {
  const router = useRouter();
  const { user, token } = useAuthStore();
  const { availableTenants, currentTenant } = useTenantStore();
  const [memberships, setMemberships] = useState<TenantMembership[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch memberships with roles on mount
  useEffect(() => {
    async function fetchMemberships() {
      if (!token) return;

      setLoading(true);
      try {
        const data = await authApi.getMemberships(token);
        setMemberships(data);
      } catch (error) {
        console.error('Failed to fetch memberships:', error);
        // Fall back to availableTenants with default role
        setMemberships(availableTenants.map(t => ({
          ...t,
          status: 'ACTIVE',
          role: 'MEMBER'
        })));
      } finally {
        setLoading(false);
      }
    }

    fetchMemberships();
  }, [token, availableTenants]);

  const handleTenantClick = (tenant: Tenant | TenantMembership) => {
    const slug = getTenantSlug(tenant);
    const role = getRoleForTenant(tenant.id);

    // Route based on role
    if (role === 'CASHIER') {
      // Cashiers go directly to PoS
      router.push(`/w/${slug}/pos`);
    } else {
      // Admins and Managers go to dashboard
      router.push(`/w/${slug}`);
    }
  };

  // Get role for a tenant from memberships
  const getRoleForTenant = (tenantId: string): string => {
    const membership = memberships.find(m => m.id === tenantId);
    return membership?.role || 'CASHIER';
  };

  // If no tenants (show card even if not logged in for demo/development)
  if (availableTenants.length === 0) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
            <Building2 className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">My Workspaces</h3>
            <p className="text-white/40 text-sm">Your organization access</p>
          </div>
        </div>

        <div className="text-center py-8">
          <Building2 className="h-12 w-12 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm mb-4">No workspaces yet</p>
          <Button
            onClick={() => router.push('/admin/workspaces')}
            className="bg-gradient-to-r from-cyan-500 to-purple-600 text-white border-0"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Workspace
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20">
            <Building2 className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <h3 className="font-semibold text-white">My Workspaces</h3>
            <p className="text-white/40 text-sm">{availableTenants.length} organization{availableTenants.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/admin/workspaces')}
          className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
        >
          <Plus className="h-4 w-4 mr-1" />
          New
        </Button>
      </div>

      {/* Workspaces List */}
      <div className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-20 rounded-xl bg-white/10" />
            <Skeleton className="h-20 rounded-xl bg-white/10" />
          </>
        ) : availableTenants.map((tenant) => {
          const role = getRoleForTenant(tenant.id);
          const isActive = currentTenant?.id === tenant.id;

          return (
            <WorkspaceItem
              key={tenant.id}
              tenant={tenant}
              isActive={isActive}
              role={role}
              onClick={() => handleTenantClick(tenant)}
            />
          );
        })}
      </div>

      {/* Quick Stats */}
      {token && (
        <div className="mt-6 pt-4 border-t border-white/10">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-lg font-bold text-white">{availableTenants.length}</div>
              <div className="text-xs text-white/40">Workspaces</div>
            </div>
            <div>
              <div className="text-lg font-bold text-cyan-400">
                {availableTenants.filter(t => t.engine === 'odoo').length}
              </div>
              <div className="text-xs text-white/40">Odoo</div>
            </div>
            <div>
              <div className="text-lg font-bold text-blue-400">
                {availableTenants.filter(t => t.engine === 'erpnext').length}
              </div>
              <div className="text-xs text-white/40">ERPNext</div>
            </div>
          </div>
        </div>
      )}

      {/* Invite Banner */}
      <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/20">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-cyan-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white/80">Invite your team</p>
            <p className="text-xs text-white/40">Collaborate across workspaces</p>
          </div>
          <ArrowUpRight className="h-4 w-4 text-cyan-400" />
        </div>
      </div>
    </div>
  );
}

export function WorkspacesCardSkeleton() {
  return (
    <div className="glass rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-6">
        <Skeleton className="h-10 w-10 rounded-xl bg-white/10" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 bg-white/10" />
          <Skeleton className="h-3 w-24 bg-white/10" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-20 rounded-xl bg-white/10" />
        <Skeleton className="h-20 rounded-xl bg-white/10" />
      </div>
    </div>
  );
}

export default WorkspacesCard;
