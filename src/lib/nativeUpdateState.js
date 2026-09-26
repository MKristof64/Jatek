const busyStatuses = new Set(['preparing', 'permission-required', 'downloading', 'confirming', 'installing']);

export function isNativeUpdateBusy(status) {
  return busyStatuses.has(status);
}

export function applyNativeInstallState(current, result) {
  if (!current.release || result?.version !== current.release.version) return current;

  const states = {
    'permission-required': {
      status: 'permission-required',
      progress: 0,
      message: 'Az Android telepítési engedélyt kér.',
    },
    'pending-confirmation': {
      status: 'confirming',
      progress: 100,
      message: 'Az ellenőrzött frissítés telepítése jóváhagyásra vár.',
    },
    installing: {
      status: 'installing',
      progress: 100,
      message: 'A frissítés átadva az Android rendszertelepítőjének.',
    },
    installed: { status: 'installed', progress: 100, message: 'A frissítés telepítve.' },
    cancelled: {
      status: 'available',
      progress: 0,
      message: 'A telepítés megszakítva. A frissítés újra elindítható.',
    },
    error: {
      status: 'error',
      progress: 0,
      message: result.message || 'A frissítés telepítése sikertelen. Próbáld újra.',
    },
  };
  return states[result.status] ? { ...current, ...states[result.status] } : current;
}
