import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { DomainConflictException } from '../../common';
import { ASSET_ERROR_CODES } from './policies/asset-error-codes';

type DbClient = Prisma.TransactionClient;

export interface EmployeeAssetMoveInput {
  employeeId: string;
  fromBranchId: string;
  toBranchId: string;
}

@Injectable()
export class AssetCustodyPreflightService {
  async assertEmployeeMoveAllowed(tx: DbClient, input: EmployeeAssetMoveInput) {
    if (input.fromBranchId === input.toBranchId) {
      return;
    }

    const openPhysical = await tx.employeeAsset.count({
      where: {
        employeeId: input.employeeId,
        status: 'ASSIGNED',
        returnedDate: null,
        asset: {
          branchId: input.fromBranchId,
          kind: { not: 'SOFTWARE_LICENSE' },
        },
      },
    });

    if (openPhysical > 0) {
      throw new DomainConflictException(
        ASSET_ERROR_CODES.EMPLOYEE_ASSET_TRANSFER_BLOCKED,
        'Cross-branch employee move is blocked while physical or card custody remains open',
      );
    }
  }
}
