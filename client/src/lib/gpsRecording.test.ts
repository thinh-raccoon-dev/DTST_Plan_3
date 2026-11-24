import { beforeEach, describe, expect, it } from 'vitest';
import { getActiveRecordingKm, useGpsRecordingStore } from '../stores/gpsRecordingStore';

describe('gpsRecordingStore — persistent multi-hour trip recording', () => {
  beforeEach(() => {
    useGpsRecordingStore.getState().clearSession();
  });

  it('records inter-provincial checkpoints (Cần Thơ -> Vĩnh Long -> Sài Gòn), filters stationary drift, and computes distance', () => {
    const t0 = 1_700_000_000_000;
    useGpsRecordingStore.getState().startRecording({
      ownerKey: 'user:test-1',
      title: 'Cần Thơ → Sài Gòn',
      initialPoint: { lat: 10.0268, lng: 105.7223, timestamp: t0 },
    });

    // Tiny stationary GPS jitter (~1m, 2s later) must be filtered out
    const jitter = useGpsRecordingStore
      .getState()
      .appendPoint({ lat: 10.026805, lng: 105.722305, timestamp: t0 + 2000 }, { accuracyMeters: 15 });
    expect(jitter.added).toBe(false);

    // Severe inaccurate cell-tower jump (>250m accuracy) must be ignored unless forced
    const noisy = useGpsRecordingStore
      .getState()
      .appendPoint({ lat: 10.05, lng: 105.75, timestamp: t0 + 10_000 }, { accuracyMeters: 600 });
    expect(noisy.added).toBe(false);

    // Resume checkpoint at Mỹ Thuận / Vĩnh Long (~40km later after phone lock)
    const cp1 = useGpsRecordingStore
      .getState()
      .appendPoint({ lat: 10.2681, lng: 105.9062, timestamp: t0 + 3_600_000 }, { force: true });
    expect(cp1.added).toBe(true);
    expect(cp1.gapKm).toBeGreaterThan(25);

    // Resume checkpoint in TP. Hồ Chí Minh (~110km later)
    const cp2 = useGpsRecordingStore
      .getState()
      .appendPoint({ lat: 10.7769, lng: 106.7009, timestamp: t0 + 10_800_000 }, { force: true });
    expect(cp2.added).toBe(true);
    expect(cp2.gapKm).toBeGreaterThan(80);

    const session = useGpsRecordingStore.getState().session;
    expect(session).not.toBeNull();
    expect(session?.points).toHaveLength(3);
    expect(session?.backgroundGapsDetected).toBe(2);
    expect(getActiveRecordingKm(session)).toBeGreaterThan(120);
  });
});
