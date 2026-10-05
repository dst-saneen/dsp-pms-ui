import { Injectable } from '@nestjs/common';

import {
  OutboxWriterService,
  WriteOutboxEventInput,
  type PrismaTx,
} from '../outbox/outbox-writer.service';

export type { WriteOutboxEventInput };

@Injectable()
export class ShiftRosterOutboxService {
  constructor(private readonly outboxWriter: OutboxWriterService) {}

  async write(tx: PrismaTx, input: WriteOutboxEventInput): Promise<void> {
    await this.outboxWriter.write(tx, input);
  }
}
