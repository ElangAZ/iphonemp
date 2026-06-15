/**
 * KeyAuth API Service for senux Player
 * Uses KeyAuth 1.3 API endpoint for license key validation
 */

const KEYAUTH_CONFIG = {
  name: "Jagadrayaelang's Application",
  ownerid: 'JuJrCeiGwq',
  version: '1.0',
  apiUrl: 'https://keyauth.win/api/1.3/',
};

const STORAGE_KEY = 'senux_license';

/**
 * Initialize a KeyAuth session
 * @returns {Promise<{success: boolean, sessionId?: string, message?: string}>}
 */
export async function initSession() {
  try {
    const params = new URLSearchParams({
      type: 'init',
      name: KEYAUTH_CONFIG.name,
      ownerid: KEYAUTH_CONFIG.ownerid,
      ver: KEYAUTH_CONFIG.version,
    });

    const response = await fetch(`${KEYAUTH_CONFIG.apiUrl}?${params.toString()}`);
    const data = await response.json();

    if (data.success) {
      return { success: true, sessionId: data.sessionid };
    } else {
      return { success: false, message: data.message || 'Gagal menginisialisasi sesi.' };
    }
  } catch (error) {
    return { success: false, message: 'Tidak bisa terhubung ke server. Cek koneksi internet.' };
  }
}

/**
 * Validate a license key against KeyAuth
 * @param {string} key - The license key to validate
 * @param {string} sessionId - The session ID from init
 * @returns {Promise<{success: boolean, message?: string, info?: object}>}
 */
export async function validateLicense(key, sessionId) {
  try {
    const params = new URLSearchParams({
      type: 'license',
      key: key,
      sessionid: sessionId,
      name: KEYAUTH_CONFIG.name,
      ownerid: KEYAUTH_CONFIG.ownerid,
      hwid: 'senux-web-player-app',
    });

    const response = await fetch(`${KEYAUTH_CONFIG.apiUrl}?${params.toString()}`);
    const data = await response.json();

    if (data.success) {
      return {
        success: true,
        info: data.info || {},
        message: data.message || 'License valid!',
      };
    } else {
      return {
        success: false,
        message: data.message || 'License key tidak valid.',
      };
    }
  } catch (error) {
    return { success: false, message: 'Gagal memvalidasi key. Cek koneksi internet.' };
  }
}

/**
 * Save validated license to localStorage
 * @param {string} key - The license key
 */
export function saveLicense(key) {
  const data = {
    key,
    validatedAt: Date.now(),
    version: KEYAUTH_CONFIG.version,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Get stored license from localStorage
 * @returns {{ key: string, validatedAt: number, version: string } | null}
 */
export function getStoredLicense() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Clear stored license (logout)
 */
export function clearLicense() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Full license validation flow: init → validate
 * @param {string} key - The license key to validate
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function activateLicense(key) {
  // Step 1: Init session
  const initResult = await initSession();
  if (!initResult.success) {
    return { success: false, message: initResult.message };
  }

  // Step 2: Validate license
  const licenseResult = await validateLicense(key, initResult.sessionId);
  if (!licenseResult.success) {
    return { success: false, message: licenseResult.message };
  }

  // Step 3: Save to localStorage
  saveLicense(key);
  return { success: true, message: 'License berhasil diaktifkan! 🎉' };
}

/**
 * Re-validate an existing stored license
 * @returns {Promise<{success: boolean, isOfflineGrace?: boolean}>}
 */
export async function revalidateStoredLicense() {
  const stored = getStoredLicense();
  if (!stored || !stored.key) {
    return { success: false };
  }

  // Try online validation
  const initResult = await initSession();
  if (!initResult.success) {
    // Offline — allow grace if previously validated
    if (stored.validatedAt) {
      return { success: true, isOfflineGrace: true };
    }
    return { success: false };
  }

  const licenseResult = await validateLicense(stored.key, initResult.sessionId);
  if (licenseResult.success) {
    // Refresh validation timestamp
    saveLicense(stored.key);
    return { success: true, isOfflineGrace: false };
  }

  // License revoked/expired — clear storage
  clearLicense();
  return { success: false };
}
