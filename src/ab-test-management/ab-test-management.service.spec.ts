import { Test, TestingModule } from '@nestjs/testing';
import { AbTestManagementService } from './ab-test-management.service';

describe('AbTestManagementService', () => {
  let service: AbTestManagementService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AbTestManagementService],
    }).compile();

    service = module.get<AbTestManagementService>(AbTestManagementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
