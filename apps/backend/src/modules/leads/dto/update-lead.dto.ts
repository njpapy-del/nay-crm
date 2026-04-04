import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateLeadDto } from './create-lead.dto';

export class UpdateLeadDto extends PartialType(OmitType(CreateLeadDto, ['campaignId'] as const)) {}
