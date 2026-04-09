export const colors = {
  primary: '#2563eb', // Fintech Blue
  primaryLight: '#eff6ff',
  danger: '#ef4444',
  success: '#10b981',
  successLight: '#f0fdf4',
  successBorder: '#bbf7d0',
  successText: '#166534',
  warning: '#f59e0b',
  processing: '#0284c7',
  processingBorder: '#bae6fd',
  processingText: '#0369a1',
  background: '#f8fafc', // Slate-50
  surface: '#ffffff',
  border: '#e2e8f0', // Slate-200
  borderLight: '#f1f5f9', // Slate-100
  textPrimary: '#1e293b', // Slate-900
  textSecondary: '#64748b', // Slate-500
  textMuted: '#94a3b8', // Slate-400
};

export const appFontFamily = '"Avenir Next", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
export const titleFontFamily = '"Segoe UI Variable Display", "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';

export const corridorStatusThemes = {
  Live: { bg: '#DCFCE7', text: '#166534' },
  Ongoing: { bg: '#DBEAFE', text: '#1E40AF' },
  Offline: { bg: '#FEF3C7', text: '#92400E' },
  'Lost connection': { bg: '#F1F5F9', text: '#475569' },
} as const;

export const getCorridorStatusTheme = (status?: string) => {
  if (status && status in corridorStatusThemes) {
    return corridorStatusThemes[status as keyof typeof corridorStatusThemes];
  }

  return { bg: '#F1F5F9', text: '#475569' };
};

export const buildCorridorStatusTagStyle = (status?: string) => {
  const theme = getCorridorStatusTheme(status);

  return {
    margin: 0,
    borderRadius: '999px',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    border: 'none',
    backgroundColor: theme.bg,
    color: theme.text,
    lineHeight: '20px',
    fontFamily: appFontFamily,
  };
};
