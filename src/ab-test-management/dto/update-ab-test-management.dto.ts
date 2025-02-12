import { PartialType } from '@nestjs/mapped-types';
import { CreateAbTestManagementDto } from './create-ab-test-management.dto';
import { AbTestManagement } from '../entities/ab-test-management.entity';

export class UpdateAbTestManagementDto extends PartialType(AbTestManagement) {
    constructor(partial: Partial<AbTestManagement>) {
        super(partial);
        delete partial.createdAt;

        // Remove all null values
        for(const key in partial) {
            if(partial[key] == null) {
                delete partial[key];
            }
        }
        return partial;
    }
}
