import { ImageResponse } from 'next/og';
import { darkenHex } from '@/lib/tenant-theme';

const DEFAULT_NAME = 'ZenDocx';
const DEFAULT_PRIMARY_COLOR = '#0D1B3E';
const DEFAULT_ACCENT_COLOR = '#F5A623';

function sanitizeName(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, 40) : DEFAULT_NAME;
}

function sanitizeHexColor(value: string | null, fallback: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? '') ? (value as string) : fallback;
}

function sanitizeSize(value: string | null) {
  const parsed = Number(value);
  if (parsed === 512) {
    return 512;
  }

  return 192;
}

function buildInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const initials = parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');

  return initials || 'Z';
}

export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tenantName = sanitizeName(searchParams.get('tenantName'));
  const primaryColor = sanitizeHexColor(
    searchParams.get('primaryColor'),
    DEFAULT_PRIMARY_COLOR,
  );
  const accentColor = sanitizeHexColor(
    searchParams.get('accentColor'),
    DEFAULT_ACCENT_COLOR,
  );
  const size = sanitizeSize(searchParams.get('size'));
  const initials = buildInitials(tenantName);
  const shortName = tenantName.length > 18 ? `${tenantName.slice(0, 18)}…` : tenantName;

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: `linear-gradient(135deg, ${primaryColor}, ${darkenHex(primaryColor, 0.18)})`,
          color: '#ffffff',
          fontFamily:
            '"Plus Jakarta Sans", "Avenir Next", "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            height: size * 0.42,
            width: size * 0.42,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: size * 0.18,
            background: accentColor,
            boxShadow: `0 ${size * 0.04}px ${size * 0.12}px rgba(0, 0, 0, 0.18)`,
            fontSize: size * 0.18,
            fontWeight: 800,
            letterSpacing: size * 0.01,
          }}
        >
          {initials}
        </div>

        <div
          style={{
            marginTop: size * 0.08,
            fontSize: size * 0.09,
            fontWeight: 700,
            opacity: 0.96,
            textAlign: 'center',
            maxWidth: size * 0.8,
          }}
        >
          {shortName}
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
    },
  );
}
