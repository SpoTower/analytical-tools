import { Test, TestingModule } from '@nestjs/testing';
import { FrontEndService } from './front-end.service';

describe('FrontEndService', () => {
  let service: FrontEndService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FrontEndService],
    }).compile();

    service = module.get<FrontEndService>(FrontEndService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
