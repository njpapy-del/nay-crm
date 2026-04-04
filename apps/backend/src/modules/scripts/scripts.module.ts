import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScriptsController } from './scripts.controller';
import { ScriptsService } from './scripts.service';
import { ScriptFieldsService } from './script-fields.service';
import { ScriptResponsesService } from './script-responses.service';

@Module({
  imports: [PrismaModule],
  controllers: [ScriptsController],
  providers: [ScriptsService, ScriptFieldsService, ScriptResponsesService],
  exports: [ScriptsService, ScriptResponsesService],
})
export class ScriptsModule {}
