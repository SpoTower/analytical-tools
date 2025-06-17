import { Injectable } from '@nestjs/common';
import { CreateFrontEndDto } from './dto/create-front-end.dto';
import { UpdateFrontEndDto } from './dto/update-front-end.dto';

@Injectable()
export class FrontEndService {
  create(createFrontEndDto: CreateFrontEndDto) {
    return 'This action adds a new frontEnd';
  }

  findAll() {
    return `This action returns all frontEnd`;
  }

  findOne(id: number) {
    return `This action returns a #${id} frontEnd`;
  }

  update(id: number, updateFrontEndDto: UpdateFrontEndDto) {
    return `This action updates a #${id} frontEnd`;
  }

  remove(id: number) {
    return `This action removes a #${id} frontEnd`;
  }
}
