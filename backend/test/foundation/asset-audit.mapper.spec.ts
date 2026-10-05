import { AssetAuditMapper } from '../../src/modules/asset-domain/asset-audit.mapper';
import { OutboxWriterService } from '../../src/modules/outbox/outbox-writer.service';

describe('AssetAuditMapper redaction', () => {
  it('strips secrets and private history fields from snapshots', () => {
    const mapper = new AssetAuditMapper();
    const snapshot = mapper.toSafeSnapshot({
      id: 'asset-1',
      status: 'ACTIVE',
      remarks: 'private remarks',
      reason: 'lost in transit',
      cardNumber: '4111111111111111',
      serialNumber: 'SN-1',
      vaultReference: 'vault://secret',
      employeeNote: 'note',
      decisionNote: 'decision',
    });

    expect(snapshot).toEqual({ id: 'asset-1', status: 'ACTIVE' });
    expect(JSON.stringify(snapshot)).not.toMatch(
      /4111|vault:\/\/|private remarks/,
    );
  });

  it('drops private keys from outbox payloads', () => {
    const writer = new OutboxWriterService();
    expect(
      writer.sanitizePayload({
        assetId: 'asset-1',
        remarks: 'secret',
        reason: 'lost',
        serialNumber: 'SN-1',
        status: 'ASSIGNED',
      }),
    ).toEqual({ assetId: 'asset-1', status: 'ASSIGNED' });
  });
});
