import { Test, TestingModule } from '@nestjs/testing';
import { SpellCheckerService } from './spell-checker.service';

describe('SpellCheckerService', () => {
  let service: SpellCheckerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SpellCheckerService],
    }).compile();

    service = module.get<SpellCheckerService>(SpellCheckerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
