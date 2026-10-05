import { PartialType } from '@nestjs/swagger';
import { CreateProjectTeamMemberDto } from './create-project-team-member.dto';

export class UpdateProjectTeamMemberDto extends PartialType(
  CreateProjectTeamMemberDto,
) {}
