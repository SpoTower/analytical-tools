import { Inject, Injectable } from '@nestjs/common';
import { Knex } from 'knex';
import { ANALYTICS_CONNECTION, KIDON_CONNECTION } from 'src/knex/knex.module';
import { AB_TEST_MANAGEMENT, KIDON_TRACKER_EVENTS } from 'src/knex/tableNames';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import { QUERY_DATE_FORMAT } from 'src/utils.ts/consts';
import { AbTestManagement } from './entities/ab-test-management.entity';
import { UpdateAbTestManagementDto } from './dto/update-ab-test-management.dto';
dayjs.extend(utc);

@Injectable()
export class AbTestManagementService {
    constructor(
        @Inject(ANALYTICS_CONNECTION) private readonly analyticsDb: Knex,
        @Inject(KIDON_CONNECTION) private readonly kidonDb: Knex,
    ) {}

    async findAll() {
        return this.analyticsDb(AB_TEST_MANAGEMENT).select('*');
    }

    async findOne(id: number) {
        return this.analyticsDb(AB_TEST_MANAGEMENT).where({ id }).first();
    }

    async create(data: any) {
        return this.analyticsDb(AB_TEST_MANAGEMENT).insert(data);
    }

    async update(id: number, data: any) {
        return this.analyticsDb(AB_TEST_MANAGEMENT).where({ id }).update(data);
    }

    async delete(id: number) {
        return this.analyticsDb(AB_TEST_MANAGEMENT).where({ id }).del();
    }

    async processAbTestEvents() {
        const events = await this._fetchEventsFromKidon();

        for (const event of events) {
            const abTest = this._trackerEventToAbTest(event);
            const activeAbTest = await this._findActiveAbTest(abTest.title, abTest.type, abTest.description, abTest.parentPath);

            if (activeAbTest) {
                await this.update(activeAbTest.id, new UpdateAbTestManagementDto(abTest));
            } else {
                await this.create(abTest);
            }
        }
    }

    _trackerEventToAbTest(event: any) {
        const values = JSON.parse(event.eventValue);
        const groupValue = event.eventName === 'page' ? event.path : Object.keys( values.lineup['1'])[0];
        return new AbTestManagement({
            title: values.title,
            description: values.description,
            domainId: event.domainId,
            type: event.eventName,
            controlGroup: values.group === 'control' ? groupValue : null,
            variantGroup: values.group === 'variant' ? groupValue : null,
            parentPath: event.eventName === 'page' ? values.userSawPath : event.path,
            hostname: event.domainName,
        });
    }

    async _findActiveAbTest(title: string, type: string, description: string, parentPath: string) {
        const now = dayjs.utc().format(QUERY_DATE_FORMAT);
        const oneDayAgo = dayjs(now).subtract(24, 'hours').format(QUERY_DATE_FORMAT);
        return await this.analyticsDb(AB_TEST_MANAGEMENT)
            .where({ title, type, description, parentPath })
            .andWhereBetween('updated_at', [oneDayAgo, now]).first();
    }

    async _fetchEventsFromKidon() {
        const nowUtc = dayjs().utc().format(QUERY_DATE_FORMAT);
        const oneHourAgo = dayjs(nowUtc).subtract(5, 'days').format(QUERY_DATE_FORMAT);
        return await this.kidonDb(KIDON_TRACKER_EVENTS).select('tracker_events.*', 'paths.path' ).from('tracker_events')
            .leftJoin('paths', 'paths.id', 'tracker_events.path_id')
            .where({ event: 'AB_TEST' })
            .andWhereBetween('tracker_events.created_at', [oneHourAgo, nowUtc]);
    }
}
