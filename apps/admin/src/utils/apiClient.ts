import type { ParsedTCX } from './tcxParser';
import type { PrivacyZone } from './privacyScrubber';

export async function uploadRide(ride: ParsedTCX): Promise<void> {
  const res = await fetch('/api/admin/rides', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ride)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload failed: ${text}`);
  }
}

export async function fetchPrivacyZones(): Promise<PrivacyZone[]> {
  try {
    const res = await fetch('/api/admin/privacy-zones');
    if (!res.ok) return [];
    const data = await res.json();
    return data.zones || [];
  } catch (err) {
    console.error('Failed to fetch zones', err);
    return [];
  }
}
