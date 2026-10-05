import { Injectable } from '@nestjs/common';
import { EmployeeDocumentCategory, Prisma } from '@prisma/client';

import { BaseRepository } from '../../../common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class EmployeeDocumentCategoryRepository extends BaseRepository<
  EmployeeDocumentCategory,
  Prisma.EmployeeDocumentCategoryFindUniqueArgs,
  Prisma.EmployeeDocumentCategoryFindFirstArgs,
  Prisma.EmployeeDocumentCategoryFindManyArgs,
  Prisma.EmployeeDocumentCategoryCreateArgs,
  Prisma.EmployeeDocumentCategoryUpdateArgs,
  Prisma.EmployeeDocumentCategoryDeleteArgs,
  Prisma.EmployeeDocumentCategoryCountArgs
> {
  constructor(prisma: PrismaService) {
    super(prisma.employeeDocumentCategory, 'Employee Document Category');
  }
}
