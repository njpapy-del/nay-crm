import { Module } from '@nestjs/common';
import { CampaignNumbersService } from './campaign-numbers.service';
import { CampaignNumbersController } from './campaign-numbers.controller';

@Module({
  controllers: [CampaignNumbersController],
  providers: [CampaignNumbersService],
  exports: [CampaignNumbersService],
})
export class CampaignNumbersModule {}
