import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import type { AuthenticatedRequest } from '../../auth';
import { RecruitmentEnabledGuard } from '../guards/recruitment-feature.guard';

import {
  SaveEvaluationDraftDto,
  SubmitEvaluationDto,
} from './dto/evaluation.dto';
import { HiringDecisionDto } from './dto/hiring-decision.dto';
import { RecruitmentMeService } from './recruitment-me.service';

@ApiTags('Recruitment - Self Service')
@UseGuards(RecruitmentEnabledGuard)
@Controller('me/recruitment')
export class RecruitmentMeController {
  constructor(private readonly recruitmentMeService: RecruitmentMeService) {}

  @Get('interviews')
  @RequirePermissions('hr.self.read')
  @ApiOperation({ summary: 'List assigned panel interviews' })
  getPanelInterviews(@Req() request: AuthenticatedRequest) {
    return this.recruitmentMeService.getPanelInterviews(request.user);
  }

  @Get('interviews/:id/evaluation')
  @RequirePermissions('hr.self.read')
  @ApiOperation({ summary: 'Get my evaluation for an interview session' })
  getEvaluation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recruitmentMeService.getEvaluation(request.user, id);
  }

  @Put('interviews/:id/evaluation/draft')
  @RequirePermissions('hr.self.manage')
  @ApiOperation({ summary: 'Save evaluation draft' })
  saveEvaluationDraft(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveEvaluationDraftDto,
  ) {
    return this.recruitmentMeService.saveEvaluationDraft(request.user, id, dto);
  }

  @Post('interviews/:id/evaluation/submit')
  @RequirePermissions('hr.self.manage')
  @ApiOperation({ summary: 'Submit evaluation' })
  submitEvaluation(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SubmitEvaluationDto,
  ) {
    return this.recruitmentMeService.submitEvaluation(request.user, id, dto);
  }

  @Get('hiring-decisions')
  @RequirePermissions('hr.self.read')
  @ApiOperation({ summary: 'Hiring manager decision queue' })
  getHiringDecisions(@Req() request: AuthenticatedRequest) {
    return this.recruitmentMeService.getHiringDecisions(request.user);
  }

  @Get('openings/:openingId/comparison')
  @RequirePermissions('hr.self.read')
  @ApiOperation({ summary: 'Compare candidates for a hiring manager opening' })
  getCandidateComparison(
    @Req() request: AuthenticatedRequest,
    @Param('openingId', ParseUUIDPipe) openingId: string,
  ) {
    return this.recruitmentMeService.getCandidateComparison(
      request.user,
      openingId,
    );
  }

  @Post('applications/:id/select')
  @RequirePermissions('hr.self.manage')
  @ApiOperation({ summary: 'Hiring manager selects candidate' })
  selectCandidate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HiringDecisionDto,
  ) {
    return this.recruitmentMeService.selectCandidate(request.user, id, dto);
  }

  @Post('applications/:id/reject')
  @RequirePermissions('hr.self.manage')
  @ApiOperation({ summary: 'Hiring manager rejects candidate' })
  rejectCandidate(
    @Req() request: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HiringDecisionDto,
  ) {
    return this.recruitmentMeService.rejectCandidate(request.user, id, dto);
  }
}
