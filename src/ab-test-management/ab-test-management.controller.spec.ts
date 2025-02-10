import { Test, TestingModule } from '@nestjs/testing';
import { AbTestManagementController } from './ab-test-management.controller';
import { AbTestManagementService } from './ab-test-management.service';

describe('AbTestManagementController', () => {
  let controller: AbTestManagementController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AbTestManagementController],
      providers: [AbTestManagementService],
    }).compile();

    controller = module.get<AbTestManagementController>(AbTestManagementController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
