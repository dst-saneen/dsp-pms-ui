import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../../common/decorators/require-permissions.decorator';
import { RecruitmentEnabledGuard } from '../guards/recruitment-feature.guard';

import { CreateJobOpeningDto } from './dto/create-job-opening.dto';
import { JobOpeningTransitionDto } from './dto/job-opening-transition.dto';
import { SearchJobOpeningDto } from './dto/search-job-opening.dto';
import { UpdateJobOpeningDto } from './dto/update-job-opening.dto';
import { JobOpeningService } from './job-opening.service';

@ApiTags('Recruitment - Job Openings')
@UseGuards(RecruitmentEnabledGuard)
@Controller('hr/recruitment/openings')
export class JobOpeningController {
  constructor(private readonly jobOpeningService: JobOpeningService) {}

  @Post()
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Create job opening' })
  create(@Body() dto: CreateJobOpeningDto) {
    return this.jobOpeningService.create(dto);
  }

  @Get()
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'List job openings' })
  findAll(@Query() query: SearchJobOpeningDto) {
    return this.jobOpeningService.findAll(query);
  }

  @Get(':id')
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'Get job opening by id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobOpeningService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Update draft job opening' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobOpeningDto,
  ) {
    return this.jobOpeningService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Delete draft job opening' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobOpeningService.remove(id);
  }

  @Get(':id/publication-checklist')
  @RequirePermissions('hr.recruitment.read')
  @ApiOperation({ summary: 'Get publication checklist' })
  getPublicationChecklist(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobOpeningService.getPublicationChecklist(id);
  }

  @Post(':id/publish')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Publish job opening' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JobOpeningTransitionDto,
  ) {
    return this.jobOpeningService.publish(id, dto.version);
  }

  @Post(':id/hold')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Put job opening on hold' })
  hold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JobOpeningTransitionDto,
  ) {
    return this.jobOpeningService.hold(id, dto.version);
  }

  @Post(':id/reopen')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Reopen job opening from hold' })
  reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JobOpeningTransitionDto,
  ) {
    return this.jobOpeningService.reopen(id, dto.version);
  }

  @Post(':id/close')
  @RequirePermissions('hr.recruitment.manage')
  @ApiOperation({ summary: 'Close job opening' })
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: JobOpeningTransitionDto,
  ) {
    return this.jobOpeningService.close(id, dto.version);
  }
}
