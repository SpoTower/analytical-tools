import { Test, TestingModule } from '@nestjs/testing';
import { SpellCheckerController } from './spell-checker.controller';
import { SpellCheckerService } from './spell-checker.service';

describe('SpellCheckerController', () => {
  let controller: SpellCheckerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SpellCheckerController],
      providers: [SpellCheckerService],
    }).compile();

    controller = module.get<SpellCheckerController>(SpellCheckerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
