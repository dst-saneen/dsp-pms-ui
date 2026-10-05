import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCompanySettingDto } from './dto/create-company-setting.dto';
import { UpdateCompanySettingDto } from './dto/update-company-setting.dto';
import { AuditService } from '../audit/audit.service';
import { OrganizationScopeService } from '../auth';
import { normalizeCompanySettingValue } from './company-setting-contract';

@Injectable()
export class CompanySettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationScope: OrganizationScopeService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateCompanySettingDto) {
    await this.organizationScope.assertCurrentCompany(dto.companyId);
    const existing = await this.prisma.companySetting.findFirst({
      where: {
        companyId: dto.companyId,
        settingKey: dto.settingKey,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Setting '${dto.settingKey}' already exists for this company`,
      );
    }

    const data = {
      ...dto,
      settingValue: normalizeCompanySettingValue(
        dto.settingKey,
        dto.settingValue,
      ),
    };

    return this.prisma.$transaction(async (tx) => {
      const setting = await tx.companySetting.create({ data });
      await this.auditService.log(
        'CompanySetting',
        setting.id,
        'CREATE',
        null,
        setting,
        { tx },
      );
      return setting;
    });
  }

  async findAllByCompany(companyId: string) {
    await this.organizationScope.assertCurrentCompany(companyId);
    return this.prisma.companySetting.findMany({
      where: { companyId },
      orderBy: { settingKey: 'asc' },
    });
  }

  async findById(id: string) {
    const setting = await this.prisma.companySetting.findUnique({
      where: { id },
    });

    if (!setting) {
      throw new NotFoundException('Company setting not found');
    }

    await this.organizationScope.assertCurrentCompany(setting.companyId);

    return setting;
  }

  async findByKey(companyId: string, settingKey: string) {
    await this.organizationScope.assertCurrentCompany(companyId);
    return this.prisma.companySetting.findUnique({
      where: {
        companyId_settingKey: {
          companyId,
          settingKey,
        },
      },
    });
  }

  async update(id: string, dto: UpdateCompanySettingDto) {
    const oldSetting = await this.findById(id);
    const data = {
      ...dto,
      settingValue:
        dto.settingValue === undefined
          ? undefined
          : normalizeCompanySettingValue(
              oldSetting.settingKey,
              dto.settingValue,
            ),
    };

    return this.prisma.$transaction(async (tx) => {
      const setting = await tx.companySetting.update({ where: { id }, data });
      await this.auditService.log(
        'CompanySetting',
        id,
        'UPDATE',
        oldSetting,
        setting,
        { tx },
      );
      return setting;
    });
  }

  async remove(id: string) {
    const oldSetting = await this.findById(id);

    return this.prisma.$transaction(async (tx) => {
      const setting = await tx.companySetting.delete({ where: { id } });
      await this.auditService.log(
        'CompanySetting',
        id,
        'DELETE',
        oldSetting,
        null,
        { tx },
      );
      return setting;
    });
  }

  async getSettingValue(
    companyId: string,
    settingKey: string,
  ): Promise<string | null> {
    const setting = await this.prisma.companySetting.findFirst({
      where: {
        companyId,
        settingKey,
      },
    });

    return setting?.settingValue ?? null;
  }
}
