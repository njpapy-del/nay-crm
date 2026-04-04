import { IsArray, IsString, ArrayMinSize } from 'class-validator';

export class AssignAgentsDto {
  @IsArray()
  @IsString({ each: true })
  @ArrayMinSize(1)
  agentIds: string[];
}
