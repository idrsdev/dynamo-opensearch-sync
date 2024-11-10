import { BaseEntityProcessor } from '@/processors/BaseEntityProcessor';
import { DynamoDBRecord } from 'aws-lambda';

export class UserEntityProcessor extends BaseEntityProcessor {
    getIndexName() {
        return 'users';
    }

    protected get uniqueIdFieldName(): string {
        return 'userId';
    }

    protected arrayEntities = {};

    private entityProcessors: BaseEntityProcessor[] = [];

    canHandle(record: DynamoDBRecord): boolean {
        const pk = record.dynamodb?.Keys?.PK.S || '';
        return pk.startsWith('USER#');
    }

    async prepareBulkRequest(record: DynamoDBRecord): Promise<any | null> {
        for (const processor of this.entityProcessors) {
            if (processor.canHandle(record)) {
                return await processor.prepareBulkRequest(record);
            }
        }

        return super.prepareBulkRequest(record);
    }
}
