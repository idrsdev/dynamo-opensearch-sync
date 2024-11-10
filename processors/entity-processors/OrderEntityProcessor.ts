import { ArrayEntity, BaseEntityProcessor } from '@/processors/BaseEntityProcessor';
import { ShipmentProcessor } from '@/processors/order-processors/ShipmentProcessor';
import { DynamoDBRecord } from 'aws-lambda';

export class OrderEntityProcessor extends BaseEntityProcessor {
    getIndexName(): string {
        return 'orders';
    }

    protected get uniqueIdFieldName(): string {
        return 'orderId';
    }

    protected arrayEntities: Record<string, ArrayEntity> = {
        ITEM: { field: 'orderItems', uniqueAttr: 'itemId', uniqueIdAttr: this.uniqueIdFieldName },
        // '<SK Begins with this keyword>': {
        //     field: 'field name for opensearch e.g {..., skills: []}',
        //     uniqueAttr: 'field that can uniquely identify the items in an array',
        //     uniqueIdAttr: 'opensearch index name, it could be different than what we declared above',
        // },
    };

    private entityProcessors: BaseEntityProcessor[] = [new ShipmentProcessor()];

    canHandle(record: DynamoDBRecord): boolean {
        const pk = record.dynamodb?.Keys?.PK.S || '';
        // Here we could also use regex if needed
        return pk.startsWith('ORDER#');
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
