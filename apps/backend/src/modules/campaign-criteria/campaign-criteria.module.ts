import { Module } from '@nestjs/common';
import { CampaignCriteriaController } from './campaign-criteria.controller';
import { CampaignCriteriaService } from './campaign-criteria.service';

@Module({
  controllers: [CampaignCriteriaController],
  providers: [CampaignCriteriaService],
  exports: [CampaignCriteriaService],
})
export class CampaignCriteriaModule {}
