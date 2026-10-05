import 'reflect-metadata';

import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { SearchFinanceTransactionDto } from './finance-transaction.dto';

describe('SearchFinanceTransactionDto pagination contract', () => {
  it('converts browser query parameters into Prisma-safe numbers', async () => {
    const dto = plainToInstance(SearchFinanceTransactionDto, {
      page: '1',
      limit: '50',
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto.page).toBe(1);
    expect(dto.limit).toBe(50);
  });

  it.each([
    ['page', '0'],
    ['page', 'not-a-number'],
    ['limit', '0'],
    ['limit', '101'],
  ] as const)('rejects an invalid %s query value', async (field, value) => {
    const dto = plainToInstance(SearchFinanceTransactionDto, {
      [field]: value,
    });

    const errors = await validate(dto);
    expect(errors.some((error) => error.property === field)).toBe(true);
  });
});
