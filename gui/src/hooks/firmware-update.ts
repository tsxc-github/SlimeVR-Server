import { BoardType, DeviceDataT } from 'solarxr-protocol';

export interface FirmwareRelease {
  name: string;
  version: string;
  changelog: string;
  firmwareFiles: Partial<Record<BoardType, { url: string; digest: string }>>;
  userCanUpdate: boolean;
}

/**
 * URL of the custom firmware. This mirrors the server-side override in
 * `server/core/src/main/java/dev/slimevr/config/FirmwareConfig.kt`: whenever
 * that override is enabled the server ignores the URL sent by the GUI and
 * downloads the firmware from the configured URL instead, so this value is
 * mostly used to build the flash request payload. Keep the two in sync.
 */
export const CUSTOM_FIRMWARE_URL = 'https://slimevr.tsxc.xyz/firmware.bin';

/**
 * The firmware version is a build timestamp. It is published next to the
 * firmware as `version.txt` (e.g. `20260830154259` for YYYYMMDDHHMMSS). The
 * tracker reports its installed version as `YYMMDDHHMMSS` (12 digits) or
 * `YYYYMMDDHHMMSS` (14 digits); both are accepted when comparing.
 */
export const CUSTOM_FIRMWARE_VERSION_URL = 'https://slimevr.tsxc.xyz/version.txt';

const ALL_BOARD_TYPES = Object.values(BoardType).filter(
  (value): value is BoardType => typeof value === 'number'
);

/**
 * Parse a firmware timestamp into epoch millis. Accepts both `YYMMDDHHMMSS`
 * (12 digits, e.g. `260830154259`) and `YYYYMMDDHHMMSS` (14 digits, e.g.
 * `20260830154259`). Returns null when the value is not a valid timestamp.
 */
export function parseFirmwareTimestamp(value: string): number | null {
  const match = /^(\d{12}|\d{14})$/.exec(value.trim());
  if (!match) return null;

  const raw = match[1];
  const year =
    raw.length === 14 ? Number(raw.slice(0, 4)) : 2000 + Number(raw.slice(0, 2));
  const rest = raw.slice(raw.length - 10); // MM DD HH MM SS
  const mo = Number(rest.slice(0, 2));
  const dd = Number(rest.slice(2, 4));
  const hh = Number(rest.slice(4, 6));
  const mi = Number(rest.slice(6, 8));
  const ss = Number(rest.slice(8, 10));

  const date = new Date(year, mo - 1, dd, hh, mi, ss);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== dd ||
    date.getHours() !== hh ||
    date.getMinutes() !== mi ||
    date.getSeconds() !== ss
  ) {
    return null;
  }
  return date.getTime();
}

function formatFirmwareTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

/**
 * Fetch the target firmware version from `version.txt`. Returns null when the
 * file is unreachable or does not contain a valid timestamp (no update is
 * announced in that case).
 */
async function fetchTargetFirmwareTimestamp(): Promise<{
  raw: string;
  timestamp: number;
} | null> {
  try {
    const response = await fetch(CUSTOM_FIRMWARE_VERSION_URL, {
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const raw = (await response.text()).trim();
    const timestamp = parseFirmwareTimestamp(raw);
    return timestamp == null ? null : { raw, timestamp };
  } catch {
    return null;
  }
}

/**
 * The firmware update page only offers the user's own firmware. The target
 * version comes from `version.txt`; when it can't be determined no update is
 * announced.
 */
export async function fetchCurrentFirmwareRelease(): Promise<FirmwareRelease | null> {
  const target = await fetchTargetFirmwareTimestamp();

  const firmwareFiles = Object.fromEntries(
    ALL_BOARD_TYPES.map((board) => [board, { url: CUSTOM_FIRMWARE_URL, digest: '' }])
  ) as Partial<Record<BoardType, { url: string; digest: string }>>;

  return {
    name: target != null ? formatFirmwareTimestamp(target.timestamp) : 'custom',
    version: target != null ? target.raw : 'custom',
    changelog: CUSTOM_FIRMWARE_URL,
    firmwareFiles,
    userCanUpdate: true,
  };
}

export function checkForUpdate(
  currentFirmwareRelease: FirmwareRelease,
  device: DeviceDataT
): 'can-update' | 'low-battery' | 'updated' | 'unavailable' | 'blocked' {
  if (!currentFirmwareRelease.userCanUpdate) return 'blocked';

  if (!device.hardwareInfo?.officialBoardType) return 'unavailable';

  if (
    device.hardwareStatus?.batteryPctEstimate != null &&
    (device.hardwareStatus.batteryPctEstimate < 50 ||
      device.hardwareStatus.batteryPctEstimate > 200)
  ) {
    return 'low-battery';
  }

  const targetTimestamp = parseFirmwareTimestamp(currentFirmwareRelease.version);
  // No known target version (version.txt missing/invalid): don't announce
  if (targetTimestamp == null) return 'updated';

  const deviceTimestamp = parseFirmwareTimestamp(
    device.hardwareInfo.firmwareVersion?.toString() ?? ''
  );
  // The device firmware doesn't report a timestamp version (e.g. HID trackers
  // report major.minor.patch): can't tell, don't announce
  if (deviceTimestamp == null) return 'updated';

  return deviceTimestamp < targetTimestamp ? 'can-update' : 'updated';
}
