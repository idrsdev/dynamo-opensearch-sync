import { BaseEntityProcessor } from '@/processors/BaseEntityProcessor';
import { OrderEntityProcessor } from '@/processors/entity-processors/OrderEntityProcessor';
import { UserEntityProcessor } from '@/processors/entity-processors/UserEntityProcessor';
import { DynamoDBRecord } from 'aws-lambda';

export class EntityProcessorFactory {
    private static domainProcessors: BaseEntityProcessor[] = [new OrderEntityProcessor(), new UserEntityProcessor()];

    /**
     * Determines the processor responsible for handling the provided DynamoDB record.
     * Iterates through available processors and returns the first one that can handle the record.
     *
     * @param {DynamoDBRecord} record - The DynamoDB record to assess.
     * @returns {BaseEntityProcessor | null} The processor that can handle the record, or null if no processor is found.
     */
    static createProcessor(record: DynamoDBRecord): BaseEntityProcessor | null {
        for (const processor of this.domainProcessors) {
            if (processor.canHandle(record)) {
                return processor;
            }
        }
        return null;
    }
}
