/**
 * PlatformAdminPage — Full Admin Governance Dashboard
 *
 * Warm ivory/beige/brown brand identity (institutional governance theme).
 * Three tabs: System Overview & Metrics | Verification Queue | Platform Admins
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShieldCheck,
  Slash,
  Users,
  UserPlus,
  X,
  XCircle,
  ArrowRight,
  CircleDot,
  TrendingUp,
  Layers,
} from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { api } from '../services/api'
import type {
  OrgGrowthDataPoint,
  OrganizationPlatformResponse,
  PlatformAdminUser,
  PlatformStatsResponse,
} from '../types/organization'

// ─── Admin Design Tokens ─────────────────────────────────────────────────────
const T = {
  bg: '#FAF6F0',
  bgCard: '#FFFDF9',
  bgCream: '#F7EEE4',
  bgBeige: '#F1E5D8',
  bgBeigeDeep: '#E9DCCF',
  border: '#E9DCCF',
  borderFocus: '#C38B5E',
  brown: '#89502E',
  brownLight: '#C38B5E',
  brownDark: '#432719',
  espresso: '#38251C',
  muted: '#987D6C',
  text: '#38251C',
  textSecondary: '#78675C',
  green: '#2D7A4F',
  greenBg: '#E6F4EC',
  greenBorder: '#A8D5BA',
  amber: '#B45309',
  amberBg: '#FEF3C7',
  amberBorder: '#FCD34D',
  red: '#B91C1C',
  redBg: '#FEE2E2',
  redBorder: '#FCA5A5',
  shadow: '0 2px 16px rgba(56,37,28,0.08)',
  shadowMd: '0 4px 24px rgba(56,37,28,0.12)',
}

// ─── Tab type ────────────────────────────────────────────────────────────────
type AdminTab = 'overview' | 'queue' | 'admins'

// ─── Mini donut chart ────────────────────────────────────────────────────────
interface DonutSegment { label: string; value: number; color: string }
const DonutChart: React.FC<{ segments: DonutSegment[]; total: number }> = ({ segments, total }) => {
  const R = 54
  const cx = 70
  const cy = 70
  const stroke = 18
  const circumference = 2 * Math.PI * R

  let offset = 0
  const paths = segments
    .filter((s) => s.value > 0)
    .map((seg) => {
      const pct = total > 0 ? seg.value / total : 0
      const dash = circumference * pct
      const gap = circumference - dash
      const path = (
        <circle
          key={seg.label}
          cx={cx}
          cy={cy}
          r={R}
          fill="none"
          stroke={seg.color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={-offset}
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
      )
      offset += dash
      return path
    })

  return (
    <svg width={140} height={140} viewBox="0 0 140 140" aria-hidden="true">
      {/* Track */}
      <circle cx={cx} cy={cy} r={R} fill="none" stroke={T.bgBeige} strokeWidth={stroke} />
      {paths}
      {/* Centre label */}
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={22} fontWeight={800} fill={T.espresso}>
        {total}
      </text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize={11} fill={T.muted}>
        Total
      </text>
    </svg>
  )
}

// ─── Mini line chart ─────────────────────────────────────────────────────────
const MiniLineChart: React.FC<{
  data: OrgGrowthDataPoint[]
  width?: number
  height?: number
}> = ({ data, width = 440, height = 160 }) => {
  if (!data || data.length === 0) return null

  const padL = 36, padR = 16, padT = 16, padB = 36
  const W = width - padL - padR
  const H = height - padT - padB
  const maxVal = Math.max(...data.map((d) => d.count), 1)

  const pts = data.map((d, i) => ({
    x: padL + (i / Math.max(data.length - 1, 1)) * W,
    y: padT + H - (d.count / maxVal) * H,
    d,
  }))

  const linePath = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ')

  const areaPath =
    `M${pts[0].x.toFixed(1)},${(padT + H).toFixed(1)} ` +
    pts.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
    ` L${pts[pts.length - 1].x.toFixed(1)},${(padT + H).toFixed(1)} Z`

  // Y axis ticks
  const yTicks = [0, Math.ceil(maxVal / 2), maxVal]

  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <defs>
        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#89502E" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#89502E" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Horizontal grid lines */}
      {yTicks.map((v) => {
        const y = padT + H - (v / maxVal) * H
        return (
          <g key={v}>
            <line x1={padL} x2={padL + W} y1={y} y2={y} stroke={T.bgBeigeDeep} strokeWidth={1} />
            <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={9} fill={T.muted}>
              {v}
            </text>
          </g>
        )
      })}

      {/* Area fill */}
      <path d={areaPath} fill="url(#areaGrad)" />

      {/* Line */}
      <path d={linePath} fill="none" stroke="#89502E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {/* Dots */}
      {pts.map((p) => (
        <circle key={p.d.month} cx={p.x} cy={p.y} r={4} fill="#89502E" stroke="#FFFDF9" strokeWidth={1.5} />
      ))}

      {/* X axis labels */}
      {pts.map((p, i) => {
        // Show every other label when many data points
        if (data.length > 8 && i % 2 !== 0) return null
        return (
          <text key={p.d.month} x={p.x} y={padT + H + 20} textAnchor="middle" fontSize={9.5} fill={T.muted}>
            {p.d.label.split(' ')[0]}
          </text>
        )
      })}
    </svg>
  )
}

// ─── Skeleton loader ─────────────────────────────────────────────────────────
const Skeleton: React.FC<{ w?: string; h?: number; radius?: number }> = ({
  w = '100%',
  h = 20,
  radius = 6,
}) => (
  <div
    style={{
      width: w,
      height: h,
      borderRadius: radius,
      background: `linear-gradient(90deg, ${T.bgBeige} 25%, ${T.bgCream} 50%, ${T.bgBeige} 75%)`,
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s infinite',
    }}
  />
)

// ─── Stat Card ────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: number | null
  icon: React.ReactNode
  accentColor?: string
  bgAccent?: string
  onClick?: () => void
  loading?: boolean
}

const StatCard: React.FC<StatCardProps> = ({
  label, value, icon, accentColor = T.brown, bgAccent = T.bgBeige, onClick, loading,
}) => (
  <div
    onClick={onClick}
    style={{
      background: T.bgCard,
      border: `1px solid ${T.border}`,
      borderRadius: 14,
      padding: '1.1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      cursor: onClick ? 'pointer' : 'default',
      boxShadow: T.shadow,
      transition: 'box-shadow 0.15s, transform 0.15s',
      flex: '1 1 160px',
      minWidth: 0,
    }}
    onMouseEnter={(e) => {
      if (onClick) {
        (e.currentTarget as HTMLDivElement).style.boxShadow = T.shadowMd
        ;(e.currentTarget as HTMLDivElement).style.transform = 'translateY(-1px)'
      }
    }}
    onMouseLeave={(e) => {
      if (onClick) {
        (e.currentTarget as HTMLDivElement).style.boxShadow = T.shadow
        ;(e.currentTarget as HTMLDivElement).style.transform = 'none'
      }
    }}
  >
    <div
      style={{
        width: 42,
        height: 42,
        borderRadius: 10,
        background: bgAccent,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: accentColor,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
    <div style={{ minWidth: 0 }}>
      {loading ? (
        <>
          <Skeleton w="60px" h={22} />
          <Skeleton w="90px" h={11} radius={4} />
        </>
      ) : (
        <>
          <div
            style={{
              fontSize: '1.6rem',
              fontWeight: 800,
              color: accentColor,
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}
          >
            {value ?? '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: T.textSecondary, marginTop: 2, lineHeight: 1.3 }}>
            {label}
          </div>
        </>
      )}
    </div>
    {onClick && !loading && (
      <ArrowRight size={14} style={{ color: T.muted, marginLeft: 'auto', flexShrink: 0, opacity: 0.6 }} />
    )}
  </div>
)

// ─── Verification status badge ────────────────────────────────────────────────
const VerifBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, { bg: string; text: string; border: string }> = {
    approved: { bg: T.greenBg, text: T.green, border: T.greenBorder },
    pending: { bg: T.amberBg, text: T.amber, border: T.amberBorder },
    rejected: { bg: T.redBg, text: T.red, border: T.redBorder },
    suspended: { bg: '#FFF0E0', text: '#92400E', border: '#FEC89A' },
  }
  const style = map[status] || { bg: T.bgBeige, text: T.brown, border: T.border }
  return (
    <span
      style={{
        background: style.bg,
        color: style.text,
        border: `1px solid ${style.border}`,
        fontSize: '0.7rem',
        fontWeight: 700,
        padding: '0.2rem 0.55rem',
        borderRadius: 99,
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}

// ─── Modal ───────────────────────────────────────────────────────────────────
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}
const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(56,37,28,0.35)',
        backdropFilter: 'blur(3px)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1.5rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 18,
          padding: '1.75rem',
          width: '100%',
          maxWidth: 480,
          boxShadow: T.shadowMd,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: T.espresso }}>{title}</h3>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.muted, padding: '0.2rem' }}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Toast ───────────────────────────────────────────────────────────────────
interface ToastProps {
  message: string | null
  kind: 'success' | 'error'
  onDismiss: () => void
}
const Toast: React.FC<ToastProps> = ({ message, kind, onDismiss }) => {
  useEffect(() => {
    if (!message) return
    const t = setTimeout(onDismiss, 5000)
    return () => clearTimeout(t)
  }, [message, onDismiss])

  if (!message) return null
  const isSuccess = kind === 'success'
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        background: isSuccess ? T.greenBg : T.redBg,
        border: `1px solid ${isSuccess ? T.greenBorder : T.redBorder}`,
        color: isSuccess ? T.green : T.red,
        padding: '0.85rem 1rem',
        borderRadius: 12,
        fontSize: '0.875rem',
        marginBottom: '1.25rem',
      }}
    >
      {isSuccess ? <CheckCircle2 size={17} style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={17} style={{ flexShrink: 0, marginTop: 1 }} />}
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={onDismiss}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: '0.1rem' }}
      >
        <X size={14} />
      </button>
    </div>
  )
}

// ─── Recent Activity Item ─────────────────────────────────────────────────────
interface ActivityEntry {
  id: string
  type: 'approved' | 'rejected' | 'suspended' | 'promoted' | 'pending'
  title: string
  actor?: string
  timestamp: string
}

const ActivityDot: React.FC<{ type: ActivityEntry['type'] }> = ({ type }) => {
  const colors: Record<ActivityEntry['type'], string> = {
    approved: T.green,
    rejected: T.red,
    suspended: T.amber,
    promoted: T.brown,
    pending: T.muted,
  }
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: `${colors[type]}18`,
        border: `2px solid ${colors[type]}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {type === 'approved' && <CheckCircle2 size={13} color={colors[type]} />}
      {type === 'rejected' && <XCircle size={13} color={colors[type]} />}
      {type === 'suspended' && <AlertTriangle size={13} color={colors[type]} />}
      {type === 'promoted' && <ShieldCheck size={13} color={colors[type]} />}
      {type === 'pending' && <Clock size={13} color={colors[type]} />}
    </div>
  )
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export const PlatformAdminPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Resolve active tab from URL ?tab=
  const tabParam = searchParams.get('tab')
  const activeTab: AdminTab = tabParam === 'queue' ? 'queue' : tabParam === 'admins' ? 'admins' : 'overview'

  const setActiveTab = (tab: AdminTab) => {
    if (tab === 'overview') {
      searchParams.delete('tab')
    } else {
      searchParams.set('tab', tab)
    }
    setSearchParams(searchParams, { replace: true })
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<PlatformStatsResponse | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  // ── Growth chart ───────────────────────────────────────────────────────────
  const [growthData, setGrowthData] = useState<OrgGrowthDataPoint[]>([])
  const [growthLoading, setGrowthLoading] = useState(true)
  const [growthPeriod, setGrowthPeriod] = useState<6 | 12>(6)

  // ── Org queue ─────────────────────────────────────────────────────────────
  const [orgs, setOrgs] = useState<OrganizationPlatformResponse[]>([])
  const [totalOrgs, setTotalOrgs] = useState(0)
  const [statusFilter, setStatusFilter] = useState<string>('pending')
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [orgPage, setOrgPage] = useState(1)
  const PAGE_SIZE = 20

  // ── Admins ────────────────────────────────────────────────────────────────
  const [admins, setAdmins] = useState<PlatformAdminUser[]>([])
  const [adminsLoading, setAdminsLoading] = useState(true)

  // ── Promote modal ─────────────────────────────────────────────────────────
  const [promoteModalOpen, setPromoteModalOpen] = useState(false)
  const [promoteEmail, setPromoteEmail] = useState('')
  const [isPromoting, setIsPromoting] = useState(false)

  // ── Action modal (reject/suspend) ─────────────────────────────────────────
  const [actionModal, setActionModal] = useState<{
    orgId: string
    orgName: string
    type: 'reject' | 'suspend'
  } | null>(null)
  const [actionReason, setActionReason] = useState('')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  // ── Review org detail modal ───────────────────────────────────────────────
  const [reviewOrg, setReviewOrg] = useState<OrganizationPlatformResponse | null>(null)

  // ── Toasts ────────────────────────────────────────────────────────────────
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Derived activity from org list ────────────────────────────────────────
  const [activities, setActivities] = useState<ActivityEntry[]>([])

  // ── Load functions ────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    setStatsLoading(true)
    try {
      const data = await api.platform.getStats()
      setStats(data)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load statistics.')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  const loadGrowth = useCallback(async (months: number) => {
    setGrowthLoading(true)
    try {
      const res = await api.platform.getGrowth(months)
      setGrowthData(res.data)
    } catch {
      setGrowthData([])
    } finally {
      setGrowthLoading(false)
    }
  }, [])

  const loadOrganizations = useCallback(async (filter: string, page: number) => {
    setOrgsLoading(true)
    try {
      const res = await api.platform.listOrganizations(filter || undefined, page, PAGE_SIZE)
      setOrgs(res.organizations || [])
      setTotalOrgs(res.total)

      // Build synthetic activity from org data
      const acts: ActivityEntry[] = (res.organizations || [])
        .filter((o) => o.verified_at)
        .sort((a, b) => new Date(b.verified_at!).getTime() - new Date(a.verified_at!).getTime())
        .slice(0, 8)
        .map((o) => ({
          id: o.id,
          type: o.verification_status === 'approved'
            ? 'approved'
            : o.verification_status === 'rejected'
            ? 'rejected'
            : o.verification_status === 'suspended'
            ? 'suspended'
            : 'pending',
          title: `Organization ${o.verification_status}`,
          actor: o.name,
          timestamp: o.verified_at!,
        }))
      setActivities(acts)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load organizations.')
    } finally {
      setOrgsLoading(false)
    }
  }, [])

  const loadAdmins = useCallback(async () => {
    setAdminsLoading(true)
    try {
      const res = await api.platform.listAdmins()
      setAdmins(res.admins || [])
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load administrators.')
    } finally {
      setAdminsLoading(false)
    }
  }, [])

  const refreshAll = useCallback(() => {
    loadStats()
    loadGrowth(growthPeriod)
    loadOrganizations(statusFilter, orgPage)
    loadAdmins()
  }, [loadStats, loadGrowth, loadOrganizations, loadAdmins, growthPeriod, statusFilter, orgPage])

  useEffect(() => {
    loadStats()
    loadGrowth(growthPeriod)
    loadOrganizations(statusFilter, orgPage)
    loadAdmins()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadGrowth(growthPeriod)
  }, [growthPeriod]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setOrgPage(1)
    loadOrganizations(statusFilter, 1)
  }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleApprove = async (orgId: string, orgName: string) => {
    if (actionInProgress) return
    setActionInProgress(orgId)
    setErrorMsg(null)
    try {
      await api.platform.approveOrg(orgId)
      setSuccessMsg(`"${orgName}" approved — invitation code provisioned.`)
      await Promise.all([loadOrganizations(statusFilter, orgPage), loadStats()])
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to approve organization.')
    } finally {
      setActionInProgress(null)
    }
  }

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!actionModal || !actionReason.trim()) return
    setActionInProgress(actionModal.orgId)
    setErrorMsg(null)
    try {
      if (actionModal.type === 'reject') {
        await api.platform.rejectOrg(actionModal.orgId, actionReason.trim())
        setSuccessMsg(`"${actionModal.orgName}" rejected.`)
      } else {
        await api.platform.suspendOrg(actionModal.orgId, actionReason.trim())
        setSuccessMsg(`"${actionModal.orgName}" suspended.`)
      }
      setActionModal(null)
      setActionReason('')
      await Promise.all([loadOrganizations(statusFilter, orgPage), loadStats()])
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : `Failed to ${actionModal.type} organization.`)
    } finally {
      setActionInProgress(null)
    }
  }

  const handlePromoteAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promoteEmail.trim()) return
    setIsPromoting(true)
    setErrorMsg(null)
    try {
      const promoted = await api.platform.promoteAdmin(promoteEmail.trim())
      setSuccessMsg(`${promoted.full_name} (${promoted.email}) granted Platform Administrator privileges.`)
      setPromoteEmail('')
      setPromoteModalOpen(false)
      await loadAdmins()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to promote administrator.')
    } finally {
      setIsPromoting(false)
    }
  }

  const handleRevokeAdmin = async (targetId: string, targetName: string) => {
    if (!window.confirm(`Revoke platform administrator privileges for "${targetName}"?`)) return
    setActionInProgress(targetId)
    setErrorMsg(null)
    try {
      await api.platform.revokeAdmin(targetId)
      setSuccessMsg(`Privileges revoked for "${targetName}".`)
      await loadAdmins()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to revoke privileges.')
    } finally {
      setActionInProgress(null)
    }
  }

  // ── Donut data ────────────────────────────────────────────────────────────
  const donutSegments = stats
    ? [
        { label: 'Active', value: stats.approved_organizations, color: '#2D7A4F' },
        { label: 'Pending', value: stats.pending_organizations, color: '#D97706' },
        { label: 'Suspended', value: stats.suspended_organizations, color: '#B45309' },
        { label: 'Rejected', value: stats.rejected_organizations, color: '#B91C1C' },
      ]
    : []

  // ── All-orgs for queue tab needs all statuses ─────────────────────────────
  const pendingOrgs = activeTab === 'queue'
    ? orgs.filter((o) => statusFilter === '' || o.verification_status === statusFilter)
    : orgs.filter((o) => o.verification_status === 'pending')

  const totalPages = Math.ceil(totalOrgs / PAGE_SIZE)

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* shimmer keyframes */}
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {/* ── Toasts ── */}
      <Toast message={successMsg} kind="success" onDismiss={() => setSuccessMsg(null)} />
      <Toast message={errorMsg} kind="error" onDismiss={() => setErrorMsg(null)} />

      {/* ── Hero Section ─────────────────────────────────────────────────── */}
      <div
        style={{
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 18,
          padding: '1.75rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.5rem',
          boxShadow: T.shadow,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Subtle background texture */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            background: 'radial-gradient(ellipse at 85% 50%, #F1E5D8 0%, transparent 60%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <span
              style={{
                background: T.bgBeige,
                color: T.brown,
                fontSize: '0.68rem',
                fontWeight: 800,
                padding: '0.2rem 0.7rem',
                borderRadius: 99,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border: `1px solid ${T.border}`,
              }}
            >
              Platform Administration
            </span>
            <span style={{ color: T.muted, fontSize: '0.82rem' }}>· Superadmin Console</span>
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.35rem, 2.5vw, 1.85rem)',
              fontWeight: 800,
              color: T.espresso,
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
            }}
          >
            Platform Governance Dashboard
          </h1>
          <p
            style={{
              color: T.textSecondary,
              fontSize: '0.9rem',
              marginTop: '0.4rem',
              maxWidth: 520,
              lineHeight: 1.5,
            }}
          >
            Manage organization lifecycle verifications, monitor global platform activity, and administer platform staff.
          </p>
          <div style={{ display: 'flex', gap: '0.65rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              onClick={refreshAll}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1.1rem',
                borderRadius: 10,
                background: T.bgBeige,
                border: `1px solid ${T.border}`,
                color: T.brown,
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} /> Refresh All
            </button>
            <button
              onClick={() => setPromoteModalOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 1.1rem',
                borderRadius: 10,
                background: T.brown,
                border: `1px solid ${T.brown}`,
                color: '#FFFDF9',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <UserPlus size={14} /> Promote Admin
            </button>
          </div>
        </div>

        {/* Institutional illustration */}
        <div style={{ position: 'relative', flexShrink: 0, opacity: 0.92 }}>
          <HeroIllustration />
        </div>
      </div>

      {/* ── Tab Bar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          background: T.bgCard,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: '0.35rem',
          boxShadow: T.shadow,
          flexWrap: 'wrap',
        }}
      >
        {(
          [
            { id: 'overview', label: 'System Overview & Metrics', icon: <BarChart3 size={15} /> },
            {
              id: 'queue',
              label: 'Organization Verification Queue',
              icon: <Building2 size={15} />,
              badge: stats?.pending_organizations,
            },
            {
              id: 'admins',
              label: `Platform Administrators (${admins.length})`,
              icon: <ShieldCheck size={15} />,
            },
          ] as { id: AdminTab; label: string; icon: React.ReactNode; badge?: number }[]
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.55rem 1.1rem',
              borderRadius: 9,
              border: 'none',
              background: activeTab === tab.id ? T.brown : 'transparent',
              color: activeTab === tab.id ? '#FFFDF9' : T.textSecondary,
              fontSize: '0.82rem',
              fontWeight: activeTab === tab.id ? 700 : 500,
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                style={{
                  background: activeTab === tab.id ? 'rgba(255,255,255,0.25)' : '#D97706',
                  color: activeTab === tab.id ? '#FFFDF9' : '#fff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '0.1rem 0.45rem',
                  borderRadius: 99,
                }}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB 1 — System Overview & Metrics
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* ── Metric Cards ── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.85rem' }}>
            <StatCard
              label="Total Organizations"
              value={stats?.total_organizations ?? null}
              icon={<Layers size={18} />}
              loading={statsLoading}
              onClick={() => { setStatusFilter(''); setActiveTab('queue') }}
            />
            <StatCard
              label="Pending Verification"
              value={stats?.pending_organizations ?? null}
              icon={<Clock size={18} />}
              accentColor={T.amber}
              bgAccent={T.amberBg}
              loading={statsLoading}
              onClick={() => { setStatusFilter('pending'); setActiveTab('queue') }}
            />
            <StatCard
              label="Approved & Active"
              value={stats?.approved_organizations ?? null}
              icon={<CheckCircle2 size={18} />}
              accentColor={T.green}
              bgAccent={T.greenBg}
              loading={statsLoading}
              onClick={() => { setStatusFilter('approved'); setActiveTab('queue') }}
            />
            <StatCard
              label="Suspended / Rejected"
              value={stats ? stats.suspended_organizations + stats.rejected_organizations : null}
              icon={<XCircle size={18} />}
              accentColor={T.red}
              bgAccent={T.redBg}
              loading={statsLoading}
              onClick={() => { setStatusFilter('suspended'); setActiveTab('queue') }}
            />
            <StatCard
              label="Registered Users"
              value={stats?.total_users ?? null}
              icon={<Users size={18} />}
              accentColor="#1D4ED8"
              bgAccent="#EFF6FF"
              loading={statsLoading}
            />
            <StatCard
              label="Platform-wide Issues"
              value={stats?.total_issues ?? null}
              icon={<AlertTriangle size={18} />}
              accentColor="#7C3AED"
              bgAccent="#F5F3FF"
              loading={statsLoading}
            />
          </div>

          {/* ── Analytics Row ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,2fr) minmax(0,1fr)', gap: '1rem' }}>

            {/* Growth Chart */}
            <div
              style={{
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: '1.5rem',
                boxShadow: T.shadow,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendingUp size={16} color={T.brown} />
                    <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.espresso }}>Organization Growth</span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: T.muted, marginTop: '0.2rem' }}>
                    Total organizations on the platform
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  {([6, 12] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setGrowthPeriod(m)}
                      style={{
                        padding: '0.3rem 0.7rem',
                        borderRadius: 8,
                        border: `1px solid ${growthPeriod === m ? T.brown : T.border}`,
                        background: growthPeriod === m ? T.brown : T.bgCard,
                        color: growthPeriod === m ? '#FFFDF9' : T.muted,
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      Last {m} Months
                    </button>
                  ))}
                </div>
              </div>

              {growthLoading ? (
                <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={22} color={T.brownLight} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : growthData.length === 0 || growthData.every((d) => d.count === 0) ? (
                <div
                  style={{
                    height: 160,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: T.muted,
                    gap: '0.5rem',
                  }}
                >
                  <BarChart3 size={32} style={{ opacity: 0.35 }} />
                  <span style={{ fontSize: '0.85rem' }}>No organization registration data for this period</span>
                </div>
              ) : (
                <MiniLineChart data={growthData} height={160} />
              )}
            </div>

            {/* Donut chart */}
            <div
              style={{
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: '1.5rem',
                boxShadow: T.shadow,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <Layers size={16} color={T.brown} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.espresso }}>Organization Status</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: T.muted, marginBottom: '1rem' }}>
                Distribution by current status
              </p>

              {statsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '1rem 0' }}>
                  <Skeleton w="140px" h={140} radius={99} />
                </div>
              ) : stats && stats.total_organizations > 0 ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <DonutChart
                      segments={donutSegments}
                      total={stats.total_organizations}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.75rem' }}>
                    {donutSegments.map((seg) => (
                      <button
                        key={seg.label}
                        onClick={() => { setStatusFilter(seg.label.toLowerCase()); setActiveTab('queue') }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.55rem',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: '0.2rem 0.35rem',
                          borderRadius: 6,
                          width: '100%',
                          textAlign: 'left',
                        }}
                      >
                        <span style={{ width: 10, height: 10, borderRadius: 3, background: seg.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8rem', color: T.text, flex: 1 }}>
                          {seg.label} ({seg.value})
                        </span>
                        <span style={{ fontSize: '0.78rem', color: T.muted }}>
                          {stats.total_organizations > 0
                            ? Math.round((seg.value / stats.total_organizations) * 100)
                            : 0}%
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: T.muted, fontSize: '0.84rem' }}>
                  No organizations registered yet.
                </div>
              )}
            </div>
          </div>

          {/* ── Bottom Row: Verification Queue preview + Activity + Quick Actions ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr) minmax(0,1fr)', gap: '1rem' }}>

            {/* Mini Verification Queue */}
            <div
              style={{
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: '1.5rem',
                boxShadow: T.shadow,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.35rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Building2 size={16} color={T.brown} />
                  <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.espresso }}>Verification Queue</span>
                </div>
                <button
                  onClick={() => { setStatusFilter('pending'); setActiveTab('queue') }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: T.brown,
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    padding: '0.25rem 0.5rem',
                    borderRadius: 7,
                  }}
                >
                  View All <ArrowRight size={12} />
                </button>
              </div>
              <p style={{ fontSize: '0.78rem', color: T.muted, marginBottom: '1rem' }}>
                Review and take action on pending registrations.
              </p>

              {orgsLoading ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {[1, 2, 3].map((i) => <Skeleton key={i} h={48} radius={10} />)}
                </div>
              ) : pendingOrgs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 1rem', color: T.muted }}>
                  <CheckCircle2 size={32} style={{ marginBottom: '0.5rem', color: T.green, opacity: 0.7 }} />
                  <p style={{ fontWeight: 600, fontSize: '0.88rem', color: T.espresso }}>All verification requests reviewed</p>
                  <p style={{ fontSize: '0.78rem', marginTop: '0.25rem' }}>
                    There are no pending organization verification requests at the moment.
                  </p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {pendingOrgs.slice(0, 4).map((org) => (
                    <div
                      key={org.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.6rem 0.75rem',
                        background: T.bgCream,
                        borderRadius: 10,
                        border: `1px solid ${T.border}`,
                        gap: '0.5rem',
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: T.espresso, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {org.name}
                        </div>
                        <div style={{ fontSize: '0.71rem', color: T.muted }}>{org.industry}</div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0 }}>
                        <button
                          onClick={() => handleApprove(org.id, org.name)}
                          disabled={actionInProgress === org.id}
                          style={{
                            padding: '0.25rem 0.55rem',
                            borderRadius: 7,
                            background: T.greenBg,
                            border: `1px solid ${T.greenBorder}`,
                            color: T.green,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setActionModal({ orgId: org.id, orgName: org.name, type: 'reject' })}
                          disabled={actionInProgress === org.id}
                          style={{
                            padding: '0.25rem 0.55rem',
                            borderRadius: 7,
                            background: T.redBg,
                            border: `1px solid ${T.redBorder}`,
                            color: T.red,
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))}
                  {pendingOrgs.length > 4 && (
                    <button
                      onClick={() => { setStatusFilter('pending'); setActiveTab('queue') }}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        background: 'none',
                        border: `1px dashed ${T.border}`,
                        borderRadius: 10,
                        color: T.brown,
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      +{pendingOrgs.length - 4} more — View all →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div
              style={{
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: '1.5rem',
                boxShadow: T.shadow,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <Activity size={16} color={T.brown} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.espresso }}>Recent Platform Activity</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: T.muted, marginBottom: '1rem' }}>
                Latest governance events
              </p>

              {activities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: T.muted, fontSize: '0.82rem' }}>
                  No recent activity records available.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                  {activities.slice(0, 5).map((act) => (
                    <div key={act.id} style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                      <ActivityDot type={act.type} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: T.espresso, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {act.title}
                        </div>
                        {act.actor && (
                          <div style={{ fontSize: '0.72rem', color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {act.actor}
                          </div>
                        )}
                        <div style={{ fontSize: '0.68rem', color: T.muted, marginTop: '0.1rem' }}>
                          {formatRelativeTime(act.timestamp)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => { setStatusFilter(''); setActiveTab('queue') }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  marginTop: '1rem',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: T.brown,
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                View Full Activity Logs <ArrowRight size={12} />
              </button>
            </div>

            {/* Quick Actions */}
            <div
              style={{
                background: T.bgCard,
                border: `1px solid ${T.border}`,
                borderRadius: 16,
                padding: '1.5rem',
                boxShadow: T.shadow,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <CircleDot size={16} color={T.brown} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: T.espresso }}>Quick Actions</span>
              </div>

              <button
                onClick={() => setPromoteModalOpen(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: T.bgCream,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = T.bgBeige)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = T.bgCream)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <UserPlus size={16} color={T.brown} />
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: T.espresso }}>Promote Admin</span>
                </div>
                <ArrowRight size={14} color={T.muted} />
              </button>

              <button
                onClick={() => navigate('/platform-admin/dashboard?tab=admins')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: T.bgCream,
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = T.bgBeige)}
                onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = T.bgCream)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <BarChart3 size={16} color={T.brown} />
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: T.espresso }}>View Platform Reports</span>
                </div>
                <ArrowRight size={14} color={T.muted} />
              </button>

              <button
                onClick={() => { setStatusFilter('pending'); setActiveTab('queue') }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  background: stats && stats.pending_organizations > 0 ? T.amberBg : T.bgCream,
                  border: `1px solid ${stats && stats.pending_organizations > 0 ? T.amberBorder : T.border}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Clock size={16} color={stats && stats.pending_organizations > 0 ? T.amber : T.muted} />
                  <span style={{ fontSize: '0.84rem', fontWeight: 600, color: T.espresso }}>
                    Review Queue
                    {stats && stats.pending_organizations > 0 && (
                      <span
                        style={{
                          marginLeft: '0.4rem',
                          background: '#D97706',
                          color: '#fff',
                          fontSize: '0.65rem',
                          fontWeight: 800,
                          padding: '0.1rem 0.4rem',
                          borderRadius: 99,
                        }}
                      >
                        {stats.pending_organizations}
                      </span>
                    )}
                  </span>
                </div>
                <ArrowRight size={14} color={T.muted} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 2 — Organization Verification Queue
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'queue' && (
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: '1.75rem',
            boxShadow: T.shadow,
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Building2 size={18} color={T.brown} />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: T.espresso }}>Organization Verification Queue</h2>
              </div>
              <p style={{ fontSize: '0.82rem', color: T.muted, marginTop: '0.25rem' }}>
                Review and take action on pending organization registrations.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.65rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: 9,
                  border: `1px solid ${T.border}`,
                  background: T.bgCard,
                  color: T.text,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="suspended">Suspended</option>
                <option value="rejected">Rejected</option>
              </select>
              <button
                onClick={() => loadOrganizations(statusFilter, orgPage)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: 9,
                  border: `1px solid ${T.border}`,
                  background: T.bgBeige,
                  color: T.brown,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                }}
              >
                <RefreshCw size={13} /> Refresh
              </button>
            </div>
          </div>

          {orgsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} h={60} radius={10} />)}
            </div>
          ) : orgs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
              <CheckCircle2 size={48} style={{ color: T.green, opacity: 0.6, marginBottom: '0.75rem' }} />
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: T.espresso }}>All verification requests reviewed</h3>
              <p style={{ color: T.muted, fontSize: '0.88rem', marginTop: '0.35rem' }}>
                {statusFilter
                  ? `No organizations with status "${statusFilter}" at the moment.`
                  : 'There are no pending organization verification requests at the moment.'}
              </p>
            </div>
          ) : (
            <>
              {/* Table */}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${T.bgBeigeDeep}` }}>
                      {['Organization', 'Industry', 'Status', 'Owner', 'Registered', 'Actions'].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: '0.65rem 0.75rem',
                            textAlign: 'left',
                            fontWeight: 700,
                            color: T.muted,
                            fontSize: '0.75rem',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {orgs.map((org, idx) => {
                      const isPending = org.verification_status === 'pending'
                      const isApproved = org.verification_status === 'approved'
                      const isSuspended = org.verification_status === 'suspended'
                      const isBusy = actionInProgress === org.id

                      return (
                        <tr
                          key={org.id}
                          style={{
                            borderBottom: `1px solid ${T.border}`,
                            background: idx % 2 === 0 ? 'transparent' : T.bgCream,
                          }}
                        >
                          <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                            <div style={{ fontWeight: 700, color: T.espresso, fontSize: '0.85rem' }}>{org.name}</div>
                            <div style={{ fontSize: '0.72rem', color: T.muted, fontFamily: 'JetBrains Mono, monospace' }}>
                              {org.slug}
                            </div>
                            {org.rejection_reason && (
                              <div
                                style={{
                                  fontSize: '0.7rem',
                                  color: T.red,
                                  marginTop: '0.2rem',
                                  background: T.redBg,
                                  padding: '0.2rem 0.45rem',
                                  borderRadius: 6,
                                  display: 'inline-block',
                                }}
                              >
                                Reason: {org.rejection_reason}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', color: T.textSecondary, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                            <span style={{ textTransform: 'capitalize' }}>{org.industry || '—'}</span>
                          </td>
                          <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                            <VerifBadge status={org.verification_status} />
                          </td>
                          <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                            {org.owner_name ? (
                              <>
                                <div style={{ fontWeight: 600, fontSize: '0.82rem', color: T.espresso }}>{org.owner_name}</div>
                                <div style={{ fontSize: '0.72rem', color: T.muted }}>{org.owner_email}</div>
                              </>
                            ) : (
                              <span style={{ color: T.muted }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem', color: T.muted, whiteSpace: 'nowrap', verticalAlign: 'middle', fontSize: '0.78rem' }}>
                            {org.created_at
                              ? new Date(org.created_at).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                          <td style={{ padding: '0.75rem', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'nowrap' }}>
                              <button
                                onClick={() => setReviewOrg(org)}
                                style={{
                                  padding: '0.3rem 0.65rem',
                                  borderRadius: 7,
                                  background: T.bgBeige,
                                  border: `1px solid ${T.border}`,
                                  color: T.brown,
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Details
                              </button>

                              {isPending && (
                                <>
                                  <button
                                    onClick={() => handleApprove(org.id, org.name)}
                                    disabled={isBusy}
                                    style={{
                                      padding: '0.3rem 0.65rem',
                                      borderRadius: 7,
                                      background: T.greenBg,
                                      border: `1px solid ${T.greenBorder}`,
                                      color: T.green,
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: isBusy ? 'not-allowed' : 'pointer',
                                      whiteSpace: 'nowrap',
                                      opacity: isBusy ? 0.6 : 1,
                                    }}
                                  >
                                    <CheckCircle2 size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => setActionModal({ orgId: org.id, orgName: org.name, type: 'reject' })}
                                    disabled={isBusy}
                                    style={{
                                      padding: '0.3rem 0.65rem',
                                      borderRadius: 7,
                                      background: T.redBg,
                                      border: `1px solid ${T.redBorder}`,
                                      color: T.red,
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      cursor: isBusy ? 'not-allowed' : 'pointer',
                                      whiteSpace: 'nowrap',
                                      opacity: isBusy ? 0.6 : 1,
                                    }}
                                  >
                                    <Slash size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                                    Reject
                                  </button>
                                </>
                              )}

                              {isApproved && (
                                <button
                                  onClick={() => setActionModal({ orgId: org.id, orgName: org.name, type: 'suspend' })}
                                  disabled={isBusy}
                                  style={{
                                    padding: '0.3rem 0.65rem',
                                    borderRadius: 7,
                                    background: T.amberBg,
                                    border: `1px solid ${T.amberBorder}`,
                                    color: T.amber,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: isBusy ? 'not-allowed' : 'pointer',
                                    whiteSpace: 'nowrap',
                                    opacity: isBusy ? 0.6 : 1,
                                  }}
                                >
                                  <AlertTriangle size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                                  Suspend
                                </button>
                              )}

                              {isSuspended && (
                                <button
                                  onClick={() => handleApprove(org.id, org.name)}
                                  disabled={isBusy}
                                  style={{
                                    padding: '0.3rem 0.65rem',
                                    borderRadius: 7,
                                    background: T.greenBg,
                                    border: `1px solid ${T.greenBorder}`,
                                    color: T.green,
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: isBusy ? 'not-allowed' : 'pointer',
                                    whiteSpace: 'nowrap',
                                    opacity: isBusy ? 0.6 : 1,
                                  }}
                                >
                                  <CheckCircle2 size={11} style={{ display: 'inline', marginRight: 3, verticalAlign: 'middle' }} />
                                  Reinstate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.78rem', color: T.muted }}>
                    Showing {(orgPage - 1) * PAGE_SIZE + 1}–{Math.min(orgPage * PAGE_SIZE, totalOrgs)} of {totalOrgs}
                  </span>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      disabled={orgPage <= 1}
                      onClick={() => { setOrgPage(orgPage - 1); loadOrganizations(statusFilter, orgPage - 1) }}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: 8,
                        border: `1px solid ${T.border}`,
                        background: orgPage <= 1 ? T.bgCream : T.bgBeige,
                        color: orgPage <= 1 ? T.muted : T.brown,
                        cursor: orgPage <= 1 ? 'not-allowed' : 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}
                    >
                      Previous
                    </button>
                    <button
                      disabled={orgPage >= totalPages}
                      onClick={() => { setOrgPage(orgPage + 1); loadOrganizations(statusFilter, orgPage + 1) }}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: 8,
                        border: `1px solid ${T.border}`,
                        background: orgPage >= totalPages ? T.bgCream : T.bgBeige,
                        color: orgPage >= totalPages ? T.muted : T.brown,
                        cursor: orgPage >= totalPages ? 'not-allowed' : 'pointer',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 3 — Platform Administrators
          ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'admins' && (
        <div
          style={{
            background: T.bgCard,
            border: `1px solid ${T.border}`,
            borderRadius: 16,
            padding: '1.75rem',
            boxShadow: T.shadow,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={18} color={T.brown} />
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, color: T.espresso }}>Platform Administrator Roster</h2>
              </div>
              <p style={{ fontSize: '0.82rem', color: T.muted, marginTop: '0.25rem' }}>
                Users with server-side platform governance privileges.
              </p>
            </div>
            <button
              onClick={() => setPromoteModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.55rem 1.1rem',
                borderRadius: 10,
                background: T.brown,
                border: `1px solid ${T.brown}`,
                color: '#FFFDF9',
                fontSize: '0.82rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <UserPlus size={14} /> Promote Admin
            </button>
          </div>

          {adminsLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {[1, 2, 3].map((i) => <Skeleton key={i} h={64} radius={10} />)}
            </div>
          ) : admins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: T.muted }}>
              <ShieldCheck size={40} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No platform administrators found.</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${T.bgBeigeDeep}` }}>
                    {['Administrator', 'Email', 'Role', 'Status', 'Member Since', 'Actions'].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: '0.65rem 0.75rem',
                          textAlign: 'left',
                          fontWeight: 700,
                          color: T.muted,
                          fontSize: '0.75rem',
                          textTransform: 'uppercase',
                          letterSpacing: '0.04em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {admins.map((adm, idx) => {
                    const isSelf = adm.id === user?.id
                    const isOnlyAdmin = admins.length === 1
                    const isBusy = actionInProgress === adm.id

                    return (
                      <tr
                        key={adm.id}
                        style={{
                          borderBottom: `1px solid ${T.border}`,
                          background: idx % 2 === 0 ? 'transparent' : T.bgCream,
                        }}
                      >
                        <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <div
                              style={{
                                width: 36,
                                height: 36,
                                borderRadius: '50%',
                                background: T.bgBeige,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                color: T.brown,
                                border: `2px solid ${T.border}`,
                                flexShrink: 0,
                              }}
                            >
                              {adm.full_name?.charAt(0).toUpperCase() || 'A'}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: T.espresso, fontSize: '0.88rem' }}>{adm.full_name}</div>
                              {isSelf && (
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    color: T.brown,
                                    fontWeight: 600,
                                    background: T.bgBeige,
                                    padding: '0.1rem 0.4rem',
                                    borderRadius: 99,
                                    border: `1px solid ${T.border}`,
                                  }}
                                >
                                  Current Session
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: T.textSecondary, fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', verticalAlign: 'middle' }}>
                          {adm.email}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              background: T.bgBeige,
                              color: T.brown,
                              border: `1px solid ${T.border}`,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.55rem',
                              borderRadius: 99,
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}
                          >
                            Platform Admin
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle' }}>
                          <span
                            style={{
                              background: adm.is_active ? T.greenBg : T.redBg,
                              color: adm.is_active ? T.green : T.red,
                              border: `1px solid ${adm.is_active ? T.greenBorder : T.redBorder}`,
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.55rem',
                              borderRadius: 99,
                            }}
                          >
                            {adm.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', color: T.muted, fontSize: '0.78rem', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                          {new Date(adm.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td style={{ padding: '0.85rem 0.75rem', verticalAlign: 'middle' }}>
                          <button
                            disabled={isSelf || isOnlyAdmin || isBusy}
                            onClick={() => handleRevokeAdmin(adm.id, adm.full_name)}
                            title={
                              isSelf
                                ? 'Cannot revoke your own privileges'
                                : isOnlyAdmin
                                ? 'Cannot revoke the last administrator'
                                : 'Revoke platform administrator privileges'
                            }
                            style={{
                              padding: '0.3rem 0.75rem',
                              borderRadius: 8,
                              background: isSelf || isOnlyAdmin ? T.bgCream : T.redBg,
                              border: `1px solid ${isSelf || isOnlyAdmin ? T.border : T.redBorder}`,
                              color: isSelf || isOnlyAdmin ? T.muted : T.red,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              cursor: isSelf || isOnlyAdmin || isBusy ? 'not-allowed' : 'pointer',
                              opacity: isSelf || isOnlyAdmin ? 0.5 : 1,
                            }}
                          >
                            Revoke
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Action Modal (Reject / Suspend) ────────────────────────────── */}
      <Modal
        isOpen={!!actionModal}
        onClose={() => { setActionModal(null); setActionReason('') }}
        title={actionModal?.type === 'reject' ? `Reject "${actionModal?.orgName}"` : `Suspend "${actionModal?.orgName}"`}
      >
        <form onSubmit={handleConfirmAction}>
          <p style={{ fontSize: '0.88rem', color: T.textSecondary, marginBottom: '1rem' }}>
            {actionModal?.type === 'reject'
              ? 'Provide a reason for rejecting this organization. The requester will be notified.'
              : 'Provide a reason for suspending this organization. The owner will be notified.'}
          </p>
          <textarea
            required
            minLength={10}
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            placeholder={
              actionModal?.type === 'reject'
                ? 'e.g. Insufficient documentation, invalid domain...'
                : 'e.g. Policy violation, fraudulent activity...'
            }
            rows={4}
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: T.bgCream,
              color: T.espresso,
              fontSize: '0.85rem',
              fontFamily: 'inherit',
              resize: 'vertical',
              outline: 'none',
              lineHeight: 1.5,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', marginTop: '1.1rem' }}>
            <button
              type="button"
              onClick={() => { setActionModal(null); setActionReason('') }}
              style={{
                padding: '0.55rem 1.2rem',
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.bgCream,
                color: T.text,
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!actionReason.trim() || !!actionInProgress}
              style={{
                padding: '0.55rem 1.2rem',
                borderRadius: 10,
                border: 'none',
                background: actionModal?.type === 'reject' ? T.red : T.amber,
                color: '#fff',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: !actionReason.trim() ? 'not-allowed' : 'pointer',
                opacity: !actionReason.trim() ? 0.7 : 1,
              }}
            >
              Confirm {actionModal?.type === 'reject' ? 'Rejection' : 'Suspension'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Promote Admin Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={promoteModalOpen}
        onClose={() => { setPromoteModalOpen(false); setPromoteEmail('') }}
        title="Promote Platform Administrator"
      >
        <p style={{ fontSize: '0.88rem', color: T.textSecondary, marginBottom: '1rem' }}>
          Enter the email address of the registered user you want to promote. They must already have an account on ResolveX.
        </p>
        <form onSubmit={handlePromoteAdmin}>
          <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: T.espresso, marginBottom: '0.4rem' }}>
            User Email Address
          </label>
          <input
            type="email"
            required
            value={promoteEmail}
            onChange={(e) => setPromoteEmail(e.target.value)}
            placeholder="administrator@example.com"
            style={{
              width: '100%',
              padding: '0.65rem 0.85rem',
              borderRadius: 10,
              border: `1px solid ${T.border}`,
              background: T.bgCream,
              color: T.espresso,
              fontSize: '0.88rem',
              fontFamily: 'inherit',
              outline: 'none',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = T.borderFocus)}
            onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
          />
          <p style={{ fontSize: '0.75rem', color: T.muted, marginTop: '0.4rem' }}>
            The user will immediately gain platform governance privileges upon confirmation.
          </p>
          <div style={{ display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              type="button"
              onClick={() => { setPromoteModalOpen(false); setPromoteEmail('') }}
              style={{
                padding: '0.55rem 1.2rem',
                borderRadius: 10,
                border: `1px solid ${T.border}`,
                background: T.bgCream,
                color: T.text,
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!promoteEmail.trim() || isPromoting}
              style={{
                padding: '0.55rem 1.2rem',
                borderRadius: 10,
                border: 'none',
                background: T.brown,
                color: '#FFFDF9',
                fontSize: '0.85rem',
                fontWeight: 700,
                cursor: !promoteEmail.trim() || isPromoting ? 'not-allowed' : 'pointer',
                opacity: !promoteEmail.trim() || isPromoting ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
              }}
            >
              {isPromoting ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <UserPlus size={14} />}
              {isPromoting ? 'Promoting…' : 'Promote Admin'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Org Review Detail Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={!!reviewOrg}
        onClose={() => setReviewOrg(null)}
        title={reviewOrg?.name ?? ''}
      >
        {reviewOrg && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <DetailRow label="Organization Name" value={reviewOrg.name} />
            <DetailRow label="Slug" value={reviewOrg.slug} mono />
            <DetailRow label="Industry" value={reviewOrg.industry} />
            <DetailRow label="Email Domain" value={reviewOrg.official_email_domain} />
            <DetailRow label="Website" value={reviewOrg.official_website} />
            <DetailRow label="Contact Phone" value={reviewOrg.contact_phone} />
            <DetailRow label="Proof Document" value={reviewOrg.proof_document_reference} />
            {reviewOrg.owner_name && <DetailRow label="Owner" value={`${reviewOrg.owner_name} (${reviewOrg.owner_email})`} />}
            <DetailRow label="Status" value={<VerifBadge status={reviewOrg.verification_status} />} />
            {reviewOrg.rejection_reason && (
              <DetailRow label="Reason" value={reviewOrg.rejection_reason} />
            )}
            {reviewOrg.created_at && (
              <DetailRow
                label="Registered"
                value={new Date(reviewOrg.created_at).toLocaleString()}
              />
            )}
            {reviewOrg.verified_at && (
              <DetailRow
                label="Reviewed At"
                value={new Date(reviewOrg.verified_at).toLocaleString()}
              />
            )}
            <DetailRow label="Members" value={String(reviewOrg.member_count ?? 0)} />
            <DetailRow label="Issues" value={String(reviewOrg.issue_count ?? 0)} />

            {/* Actions inside detail modal */}
            {reviewOrg.verification_status === 'pending' && (
              <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.5rem' }}>
                <button
                  onClick={() => { handleApprove(reviewOrg.id, reviewOrg.name); setReviewOrg(null) }}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: 10,
                    background: T.greenBg,
                    border: `1px solid ${T.greenBorder}`,
                    color: T.green,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Approve
                </button>
                <button
                  onClick={() => { setActionModal({ orgId: reviewOrg.id, orgName: reviewOrg.name, type: 'reject' }); setReviewOrg(null) }}
                  style={{
                    flex: 1,
                    padding: '0.6rem',
                    borderRadius: 10,
                    background: T.redBg,
                    border: `1px solid ${T.redBorder}`,
                    color: T.red,
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: '0.85rem',
                  }}
                >
                  Reject
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

// ─── Detail Row helper ────────────────────────────────────────────────────────
const DetailRow: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({
  label, value, mono,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: '0.5rem',
      padding: '0.45rem 0',
      borderBottom: `1px solid ${T.bgBeigeDeep}`,
    }}
  >
    <span
      style={{
        fontSize: '0.75rem',
        fontWeight: 700,
        color: T.muted,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        width: 130,
        flexShrink: 0,
        paddingTop: '0.1rem',
      }}
    >
      {label}
    </span>
    <span
      style={{
        fontSize: '0.84rem',
        color: T.espresso,
        flex: 1,
        fontFamily: mono ? 'JetBrains Mono, monospace' : undefined,
        wordBreak: 'break-word',
      }}
    >
      {value}
    </span>
  </div>
)

// ─── Hero Illustration ────────────────────────────────────────────────────────
// Faithful recreation of the flat-style modern institutional building
// with warm peach/beige tones, shield emblem, and green trees.
const HeroIllustration: React.FC = () => (
  <svg
    width="300"
    height="160"
    viewBox="0 0 300 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    style={{ display: 'block' }}
  >
    <defs>
      {/* Sky gradient — warm cream to pale peach */}
      <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#FDF4EC" />
        <stop offset="100%" stopColor="#F5E6D6" />
      </linearGradient>
      {/* Hill/ground gradient */}
      <linearGradient id="hillGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#E8D5BF" />
        <stop offset="100%" stopColor="#DCBFA0" />
      </linearGradient>
      {/* Shield gradient */}
      <linearGradient id="shieldGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#E8A87C" />
        <stop offset="100%" stopColor="#C9784A" />
      </linearGradient>
    </defs>

    {/* ── Sky background ── */}
    <rect width="300" height="160" fill="url(#skyGrad)" />

    {/* ── Soft hill / ground ── */}
    <ellipse cx="150" cy="158" rx="175" ry="38" fill="url(#hillGrad)" />
    <rect x="0" y="148" width="300" height="12" fill="#DCBFA0" />

    {/* ══════════════════════════════
        MAIN BUILDING — flat modern
        ══════════════════════════════ */}

    {/* Building shadow / depth base */}
    <rect x="68" y="50" width="164" height="102" rx="4" fill="#C8906A" opacity="0.25" />

    {/* Main body — warm cream-peach */}
    <rect x="66" y="48" width="168" height="102" rx="3" fill="#F0C9A0" />

    {/* Horizontal band — slightly darker, upper third */}
    <rect x="66" y="48" width="168" height="38" rx="3" fill="#E8B988" />
    <rect x="66" y="82" width="168" height="4" fill="#D9A878" />

    {/* Top parapet / roof cap */}
    <rect x="60" y="42" width="180" height="10" rx="3" fill="#E0A870" />
    <rect x="64" y="38" width="172" height="6" rx="2" fill="#EBB980" />
    <rect x="70" y="34" width="160" height="6" rx="2" fill="#F0C9A0" />

    {/* ── Columns / pilasters (left panel) ── */}
    <rect x="74"  y="86" width="10" height="64" rx="2" fill="#D9A878" />
    <rect x="94"  y="86" width="10" height="64" rx="2" fill="#D9A878" />

    {/* ── Columns / pilasters (right panel) ── */}
    <rect x="216" y="86" width="10" height="64" rx="2" fill="#D9A878" />
    <rect x="196" y="86" width="10" height="64" rx="2" fill="#D9A878" />

    {/* ── Windows — upper row (left pair) ── */}
    <rect x="72" y="54" width="16" height="22" rx="2" fill="#E8C8A0" opacity="0.7" />
    <rect x="72" y="54" width="16" height="22" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />
    <rect x="96" y="54" width="16" height="22" rx="2" fill="#E8C8A0" opacity="0.7" />
    <rect x="96" y="54" width="16" height="22" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />

    {/* ── Windows — upper row (right pair) ── */}
    <rect x="192" y="54" width="16" height="22" rx="2" fill="#E8C8A0" opacity="0.7" />
    <rect x="192" y="54" width="16" height="22" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />
    <rect x="216" y="54" width="16" height="22" rx="2" fill="#E8C8A0" opacity="0.7" />
    <rect x="216" y="54" width="16" height="22" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />

    {/* ── Windows — lower row (left pair) ── */}
    <rect x="72" y="92" width="16" height="20" rx="2" fill="#E0B890" opacity="0.65" />
    <rect x="72" y="92" width="16" height="20" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />
    <rect x="96" y="92" width="16" height="20" rx="2" fill="#E0B890" opacity="0.65" />
    <rect x="96" y="92" width="16" height="20" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />

    {/* ── Windows — lower row (right pair) ── */}
    <rect x="192" y="92" width="16" height="20" rx="2" fill="#E0B890" opacity="0.65" />
    <rect x="192" y="92" width="16" height="20" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />
    <rect x="216" y="92" width="16" height="20" rx="2" fill="#E0B890" opacity="0.65" />
    <rect x="216" y="92" width="16" height="20" rx="2" fill="none" stroke="#D9A878" strokeWidth="1" />

    {/* ── Centre panel — slightly recessed, darker ── */}
    <rect x="114" y="48" width="72" height="102" rx="2" fill="#E8B07A" opacity="0.35" />

    {/* ── Shield / emblem on centre panel ── */}
    {/* Shield body */}
    <path
      d="M150 58 L164 64 L164 76 Q164 86 150 92 Q136 86 136 76 L136 64 Z"
      fill="url(#shieldGrad)"
    />
    {/* Shield inner lighter tone */}
    <path
      d="M150 62 L161 67 L161 76 Q161 84 150 89 Q139 84 139 76 L139 67 Z"
      fill="#F5C898"
      opacity="0.6"
    />
    {/* Check mark */}
    <polyline
      points="143,75 148,81 158,68"
      stroke="#C9784A"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />

    {/* ── Door — arched, centre ── */}
    <rect x="138" y="118" width="24" height="32" rx="2" fill="#C8845A" />
    {/* Arch */}
    <path d="M138 126 Q150 112 162 126" fill="#C8845A" />
    <path d="M138 126 Q150 113 162 126" fill="none" stroke="#B87048" strokeWidth="1" />
    {/* Door line */}
    <line x1="150" y1="118" x2="150" y2="150" stroke="#B87048" strokeWidth="0.8" opacity="0.7" />

    {/* ── Steps ── */}
    <rect x="128" y="148" width="44" height="4" rx="1" fill="#D9A878" />
    <rect x="132" y="144" width="36" height="5" rx="1" fill="#E0B888" />

    {/* ══════════════════════════════
        LEFT TREE
        ══════════════════════════════ */}
    {/* Trunk */}
    <rect x="34" y="120" width="6" height="28" rx="2" fill="#A07848" />
    {/* Main foliage blob */}
    <ellipse cx="37" cy="108" rx="22" ry="20" fill="#8DB86A" />
    {/* Lighter highlight */}
    <ellipse cx="33" cy="102" rx="12" ry="11" fill="#A0CC78" opacity="0.7" />
    {/* Darker shadow */}
    <ellipse cx="44" cy="116" rx="10" ry="8" fill="#709050" opacity="0.5" />
    {/* Small inner branch visible */}
    <rect x="36" y="114" width="3" height="10" rx="1" fill="#A07848" opacity="0.6" />

    {/* ══════════════════════════════
        RIGHT TREE (slightly smaller)
        ══════════════════════════════ */}
    {/* Trunk */}
    <rect x="258" y="122" width="5" height="26" rx="2" fill="#A07848" />
    {/* Main foliage blob */}
    <ellipse cx="260" cy="112" rx="19" ry="17" fill="#8DB86A" />
    {/* Lighter highlight */}
    <ellipse cx="256" cy="107" rx="10" ry="9" fill="#A0CC78" opacity="0.7" />
    {/* Darker shadow */}
    <ellipse cx="267" cy="118" rx="9" ry="7" fill="#709050" opacity="0.5" />

    {/* ══════════════════════════════
        SMALL SIDE TREES / SHRUBS
        ══════════════════════════════ */}
    {/* Far left small shrub */}
    <rect x="8" y="132" width="4" height="16" rx="1" fill="#B08848" />
    <ellipse cx="10" cy="126" rx="10" ry="11" fill="#7FAA58" />
    <ellipse cx="7" cy="122" rx="6" ry="7" fill="#96C068" opacity="0.65" />

    {/* Far right small shrub */}
    <rect x="288" y="133" width="4" height="15" rx="1" fill="#B08848" />
    <ellipse cx="290" cy="127" rx="9" ry="10" fill="#7FAA58" />
    <ellipse cx="287" cy="123" rx="5" ry="6" fill="#96C068" opacity="0.65" />
  </svg>
)
