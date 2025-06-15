import { Test, TestingModule } from '@nestjs/testing';
import { FrontEndController } from './front-end.controller';
import { FrontEndService } from './front-end.service';

describe('FrontEndController', () => {
  let controller: FrontEndController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FrontEndController],
      providers: [FrontEndService],
    }).compile();

    controller = module.get<FrontEndController>(FrontEndController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
