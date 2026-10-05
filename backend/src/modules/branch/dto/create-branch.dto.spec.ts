import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { CreateBranchDto } from './create-branch.dto';

const validBranch = {
  companyId: '11111111-1111-4111-8111-111111111111',
  branchName: 'Kochi Headquarters QA',
  countryCode: 'in',
  countrySubdivisionCode: 'in-kl',
  timezone: 'Asia/Kolkata',
};

describe('CreateBranchDto location contract', () => {
  it('normalizes and accepts a production-shaped location', async () => {
    const dto = plainToInstance(CreateBranchDto, validBranch);

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.countryCode).toBe('IN');
    expect(dto.countrySubdivisionCode).toBe('IN-KL');
  });

  it.each([
    ['countryCode', ''],
    ['countrySubdivisionCode', 'Kerala'],
    ['timezone', 'India time'],
  ] as const)('rejects an invalid %s', async (field, value) => {
    const dto = plainToInstance(CreateBranchDto, {
      ...validBranch,
      [field]: value,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});
