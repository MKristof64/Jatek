import assert from 'node:assert/strict';
import test from 'node:test';
import { applyNativeInstallState, isNativeUpdateBusy } from '../src/lib/nativeUpdateState.js';

const available = { status: 'available', release: { version: '1.2.9' }, progress: 0, message: '' };
const result = (status, extra = {}) => ({ status, version: '1.2.9', ...extra });

test('native permission, confirmation and installation keep duplicate update actions disabled', () => {
  for (const [nativeStatus, expectedStatus] of [
    ['permission-required', 'permission-required'],
    ['pending-confirmation', 'confirming'],
    ['installing', 'installing'],
  ]) {
    const state = applyNativeInstallState(available, result(nativeStatus));
    assert.equal(state.status, expectedStatus);
    assert.equal(isNativeUpdateBusy(state.status), true);
    assert.equal(state.release, available.release);
  }
  assert.equal(isNativeUpdateBusy('preparing'), true);
  assert.equal(isNativeUpdateBusy('downloading'), true);
  assert.equal(isNativeUpdateBusy('available'), false);
});

test('cancelled and failed native installs can be retried without losing the release', () => {
  const installing = applyNativeInstallState(available, result('installing'));
  const cancelled = applyNativeInstallState(installing, result('cancelled'));
  assert.equal(cancelled.status, 'available');
  assert.equal(cancelled.progress, 0);
  assert.equal(cancelled.release, available.release);
  assert.equal(isNativeUpdateBusy(cancelled.status), false);
  const failed = applyNativeInstallState(installing, result('error', { message: 'Nincs elég hely.' }));
  assert.equal(failed.status, 'error');
  assert.equal(failed.message, 'Nincs elég hely.');
  assert.equal(isNativeUpdateBusy(failed.status), false);
});

test('stale or unknown native events cannot overwrite a newer update or current error', () => {
  const error = { ...available, status: 'error', message: 'Hiba' };
  assert.equal(applyNativeInstallState(error, result('installed', { version: '1.2.8' })), error);
  assert.equal(applyNativeInstallState(error, result('unknown')), error);
  assert.equal(applyNativeInstallState(error, null), error);
  const noRelease = { status: 'idle', release: null };
  assert.equal(applyNativeInstallState(noRelease, result('installing')), noRelease);
});

test('successful native installation is distinguished from merely downloading a file', () => {
  const installed = applyNativeInstallState(available, result('installed'));
  assert.equal(installed.status, 'installed');
  assert.equal(installed.progress, 100);
  assert.equal(isNativeUpdateBusy(installed.status), false);
});
