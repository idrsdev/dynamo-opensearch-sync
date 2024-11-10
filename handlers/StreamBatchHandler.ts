import { DynamoDBStreamEvent } from 'aws-lambda';
import { BatchProcessor } from '../processors/BatchProcessor';

export const handler = async (event: DynamoDBStreamEvent) => {
    const batchId = Date.now().toString();
    console.log(`Processing Batch ID: ${batchId}`);

    const batchProcessor = new BatchProcessor();

    for (const record of event.Records) {
        await batchProcessor.addToBatch(record);
    }

    await batchProcessor.flushBatch();
    console.log(`Processed Batch with ID: ${batchId}`);
};
