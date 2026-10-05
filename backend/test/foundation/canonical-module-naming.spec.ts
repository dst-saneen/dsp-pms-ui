import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repositoryRoot = resolve(__dirname, '../..');

describe('canonical active module naming', () => {
  it('loads the onboarding runtime through canonical implementation names', () => {
    const modulePath = resolve(
      repositoryRoot,
      'src/modules/onboarding-runtime/onboarding-runtime.module.ts',
    );
    const controllerPath = resolve(
      repositoryRoot,
      'src/modules/onboarding-runtime/controllers/onboarding-runtime.controller.ts',
    );
    const appModule = readFileSync(
      resolve(repositoryRoot, 'src/app.module.ts'),
      'utf8',
    );

    expect(existsSync(modulePath)).toBe(true);
    expect(existsSync(controllerPath)).toBe(true);
    expect(
      existsSync(resolve(repositoryRoot, 'src/modules/onboarding-v2')),
    ).toBe(false);
    expect(appModule).toContain('OnboardingRuntimeModule');
    expect(appModule).not.toContain('OnboardingV2Module');
    expect(readFileSync(modulePath, 'utf8')).toContain(
      'export class OnboardingRuntimeModule',
    );
    expect(readFileSync(controllerPath, 'utf8')).toContain(
      'export class OnboardingRuntimeController',
    );
  });

  it('uses canonical wording in active runtime code while preserving stored values', () => {
    const runtimeSources = [
      'src/modules/onboarding-runtime/constants/onboarding-error-codes.ts',
      'src/modules/onboarding-runtime/constants/onboarding-permissions.ts',
      'src/modules/onboarding-runtime/contracts/onboarding-runtime.contracts.ts',
      'src/modules/onboarding-runtime/dto/onboarding-command.dto.ts',
      'src/modules/onboarding-runtime/guards/onboarding-enabled.guard.ts',
      'src/modules/onboarding-runtime/services/onboarding-imported-reconciliation.service.ts',
    ].map((path) => readFileSync(resolve(repositoryRoot, path), 'utf8'));
    const source = runtimeSources.join('\n');

    expect(source).not.toMatch(/Onboarding V2|Asset V2|Runtime views \(V2\)/);
    expect(source).not.toMatch(
      /Legacy compatibility|normal V2|Legacy onboarding/,
    );
    expect(source).toContain("'LEGACY_V1'");
    expect(source).toContain("'V2'");
  });

  it('uses retired terminology for disabled project compatibility routes', () => {
    expect(
      existsSync(resolve(repositoryRoot, 'src/modules/projects/retired')),
    ).toBe(true);
    expect(
      existsSync(resolve(repositoryRoot, 'src/modules/projects/legacy')),
    ).toBe(false);
  });
});
