import { EmployeeOnboardingTaskController } from '../../src/modules/employee-onboarding-task/employee-onboarding-task.controller';
import { EmployeeOnboardingController } from '../../src/modules/employee-onboarding/employee-onboarding.controller';
import {
  CancelEmployeeOnboardingDto,
  CompleteEmployeeOnboardingDto,
  StartEmployeeOnboardingDto,
} from '../../src/modules/onboarding-runtime/dto/onboarding-command.dto';
import {
  CompleteOnboardingTaskCommandDto,
  StartOnboardingTaskCommandDto,
} from '../../src/modules/onboarding-runtime/dto/task-command.dto';

describe('canonical onboarding command routing', () => {
  const request = { user: { id: 'user-1' } } as never;

  it('always sends task writes through the authorization-aware runtime', async () => {
    const runtime = {
      startTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
      completeTask: jest.fn().mockResolvedValue({ id: 'task-1' }),
    };
    const controller = new EmployeeOnboardingTaskController(runtime as never);

    await controller.startTask(request, 'task-1', {} as never);
    await controller.completeTask(request, 'task-1', {} as never);

    expect(runtime.startTask).toHaveBeenCalledWith(
      (request as { user: unknown }).user,
      'task-1',
      {},
    );
    expect(runtime.completeTask).toHaveBeenCalledWith(
      (request as { user: unknown }).user,
      'task-1',
      {},
    );
  });

  it('exposes concrete task command DTO metadata for request validation', () => {
    const startTypes = Reflect.getMetadata(
      'design:paramtypes',
      EmployeeOnboardingTaskController.prototype,
      'startTask',
    ) as unknown[];
    const completeTypes = Reflect.getMetadata(
      'design:paramtypes',
      EmployeeOnboardingTaskController.prototype,
      'completeTask',
    ) as unknown[];

    expect(startTypes[2]).toBe(StartOnboardingTaskCommandDto);
    expect(completeTypes[2]).toBe(CompleteOnboardingTaskCommandDto);
  });

  it('does not fall back to legacy onboarding creation or completion', async () => {
    const legacy = {
      create: jest.fn(),
      completeOnboarding: jest.fn(),
    };
    const runtime = {
      start: jest.fn().mockResolvedValue({ id: 'onboarding-1' }),
      complete: jest.fn().mockResolvedValue({ id: 'onboarding-1' }),
    };
    const controller = new EmployeeOnboardingController(
      legacy as never,
      runtime as never,
    );

    await controller.create(request, {} as never);
    await controller.completeOnboarding(request, 'onboarding-1', {} as never);

    expect(runtime.start).toHaveBeenCalled();
    expect(runtime.complete).toHaveBeenCalled();
    expect(legacy.create).not.toHaveBeenCalled();
    expect(legacy.completeOnboarding).not.toHaveBeenCalled();
  });

  it('routes both cancellation URLs through the V2 command contract', async () => {
    const legacy = {
      remove: jest.fn(),
    };
    const runtime = {
      cancel: jest.fn().mockResolvedValue({ id: 'onboarding-1' }),
    };
    const controller = new EmployeeOnboardingController(
      legacy as never,
      runtime as never,
    );
    const dto = {
      operationId: '11111111-1111-4111-8111-111111111111',
      expectedOnboardingVersion: 4,
      reason: 'Cancelled by HR',
    };

    await controller.remove(request, 'onboarding-1', dto);
    await controller.cancel(request, 'onboarding-1', dto);

    expect(runtime.cancel).toHaveBeenNthCalledWith(
      1,
      (request as { user: unknown }).user,
      'onboarding-1',
      dto,
    );
    expect(runtime.cancel).toHaveBeenNthCalledWith(
      2,
      (request as { user: unknown }).user,
      'onboarding-1',
      dto,
    );
    expect(legacy.remove).not.toHaveBeenCalled();
  });

  it('exposes concrete onboarding command DTO metadata for validation', () => {
    const startTypes = Reflect.getMetadata(
      'design:paramtypes',
      EmployeeOnboardingController.prototype,
      'create',
    ) as unknown[];
    const completeTypes = Reflect.getMetadata(
      'design:paramtypes',
      EmployeeOnboardingController.prototype,
      'completeOnboarding',
    ) as unknown[];
    const deleteCancelTypes = Reflect.getMetadata(
      'design:paramtypes',
      EmployeeOnboardingController.prototype,
      'remove',
    ) as unknown[];
    const postCancelTypes = Reflect.getMetadata(
      'design:paramtypes',
      EmployeeOnboardingController.prototype,
      'cancel',
    ) as unknown[];

    expect(startTypes[1]).toBe(StartEmployeeOnboardingDto);
    expect(completeTypes[2]).toBe(CompleteEmployeeOnboardingDto);
    expect(deleteCancelTypes[2]).toBe(CancelEmployeeOnboardingDto);
    expect(postCancelTypes[2]).toBe(CancelEmployeeOnboardingDto);
  });
});
