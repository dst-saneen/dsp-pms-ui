import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common';
import type { AuthenticatedRequest } from './auth.types';
import { CreateUserDto } from './dto/create-user.dto';
import { CloneRoleDto } from './dto/clone-role.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { ReplaceRoleAssignmentsDto } from './dto/replace-role-assignments.dto';
import { ReplaceRolePermissionsDto } from './dto/replace-role-permissions.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { UpdateRoleStatusDto } from './dto/update-role-status.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { RoleAdministrationService } from './role-administration.service';
import { UserAdministrationService } from './user-administration.service';

@ApiTags('Security Administration')
@ApiBearerAuth()
@Controller('security')
export class UserAdministrationController {
  constructor(
    private readonly userAdministration: UserAdministrationService,
    private readonly roleAdministration: RoleAdministrationService,
  ) {}

  @Get('users')
  @RequirePermissions('security.users.read')
  findUsers(@Req() request: AuthenticatedRequest) {
    return this.userAdministration.findAll(request.user);
  }

  @Post('users')
  @RequirePermissions('security.users.manage')
  createUser(@Req() request: AuthenticatedRequest, @Body() dto: CreateUserDto) {
    return this.userAdministration.create(
      request.user,
      dto,
      this.metadata(request),
    );
  }

  @Patch('users/:userId/status')
  @RequirePermissions('security.users.manage')
  updateStatus(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.userAdministration.updateStatus(
      request.user,
      userId,
      dto.status,
    );
  }

  @Post('users/:userId/reset-password')
  @RequirePermissions('security.users.manage')
  resetPassword(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.userAdministration.resetPassword(
      request.user,
      userId,
      this.metadata(request),
    );
  }

  @Post('users/:userId/invitations/resend')
  @RequirePermissions('security.users.manage')
  resendInvitation(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.userAdministration.resendInvitation(
      request.user,
      userId,
      this.metadata(request),
    );
  }

  @Get('users/:userId/sessions')
  @RequirePermissions('security.users.read')
  listSessions(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.userAdministration.listSessions(request.user, userId);
  }

  @Delete('users/:userId/sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('security.users.manage')
  revokeSession(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ) {
    return this.userAdministration.revokeSession(
      request.user,
      userId,
      sessionId,
    );
  }

  @Put('users/:userId/role-assignments')
  @RequirePermissions('security.roles.manage')
  replaceRoleAssignments(
    @Req() request: AuthenticatedRequest,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: ReplaceRoleAssignmentsDto,
  ) {
    return this.userAdministration.replaceAssignments(
      request.user,
      userId,
      dto.roleAssignments,
    );
  }

  @Get('roles')
  @RequirePermissions('security.roles.read')
  getRoles(
    @Req() request: AuthenticatedRequest,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.userAdministration.getRoles(
      request.user,
      includeInactive === 'true',
    );
  }

  @Get('permissions')
  @RequirePermissions('security.roles.read')
  getPermissions(@Req() request: AuthenticatedRequest) {
    return this.userAdministration.getPermissions(request.user);
  }

  @Post('roles')
  @RequirePermissions('security.roles.manage')
  createRole(@Req() request: AuthenticatedRequest, @Body() dto: CreateRoleDto) {
    return this.roleAdministration.create(request.user, dto);
  }

  @Post('roles/:roleId/clone')
  @RequirePermissions('security.roles.manage')
  cloneRole(
    @Req() request: AuthenticatedRequest,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: CloneRoleDto,
  ) {
    return this.roleAdministration.clone(request.user, roleId, dto.name);
  }

  @Patch('roles/:roleId')
  @RequirePermissions('security.roles.manage')
  updateRole(
    @Req() request: AuthenticatedRequest,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.roleAdministration.update(request.user, roleId, dto);
  }

  @Put('roles/:roleId/permissions')
  @RequirePermissions('security.roles.manage')
  replaceRolePermissions(
    @Req() request: AuthenticatedRequest,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: ReplaceRolePermissionsDto,
  ) {
    return this.roleAdministration.replacePermissions(
      request.user,
      roleId,
      dto.permissionIds,
    );
  }

  @Patch('roles/:roleId/status')
  @RequirePermissions('security.roles.manage')
  updateRoleStatus(
    @Req() request: AuthenticatedRequest,
    @Param('roleId', ParseUUIDPipe) roleId: string,
    @Body() dto: UpdateRoleStatusDto,
  ) {
    return this.roleAdministration.updateStatus(
      request.user,
      roleId,
      dto.isActive,
    );
  }

  private metadata(request: AuthenticatedRequest) {
    return {
      ip: request.ip,
      userAgent: request.get('user-agent'),
    };
  }
}
