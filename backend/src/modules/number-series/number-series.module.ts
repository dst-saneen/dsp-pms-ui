import { Global, Module } from '@nestjs/common';

import { NumberSeriesService } from './number-series.service';

@Global()
@Module({
  providers: [NumberSeriesService],
  exports: [NumberSeriesService],
})
export class NumberSeriesModule {}
