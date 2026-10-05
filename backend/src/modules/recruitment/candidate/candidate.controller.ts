import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RecruitmentEnabledGuard } from '../guards/recruitment-feature.guard';

import { CandidateService } from './candidate.service';
import { InternalCandidateIntakeDto } from './dto/internal-intake.dto';
import { SearchCandidateDto } from './dto/search-candidate.dto';

const INTERNAL_CV_UPLOAD_LIMITS = {
  fileSize: 10 * 1024 * 1024,
};

@ApiTags('Recruitment - Candidates')
@UseGuards(RecruitmentEnabledGuard)
@Controller('hr/recruitment/candidates')
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  @Get()
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'List candidates' })
  findAll(@Query() query: SearchCandidateDto) {
    return this.candidateService.findAll(query);
  }

  @Post('internal-intake')
  @RequirePermissions('hr.recruitment.manage')
  @ApiConsumes('multipart/form-data', 'application/json')
  @UseInterceptors(FileInterceptor('cv', { limits: INTERNAL_CV_UPLOAD_LIMITS }))
  @ApiOperation({ summary: 'Create candidate and application via HR intake' })
  internalIntake(
    @Body() dto: InternalCandidateIntakeDto,
    @UploadedFile() cv?: Express.Multer.File,
  ) {
    return this.candidateService.internalIntake(dto, cv);
  }

  @Get(':id')
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'Get candidate by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.candidateService.findOne(id);
  }
}
