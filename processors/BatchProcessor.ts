import { DynamoDBRecord } from 'aws-lambda';
import { EntityProcessorFactory } from './EntityProcessorFactory';
import { OpenSearchBulkService } from '../services/OpenSearchBulkService';

export class BatchProcessor {
    private batch: Array<[any, any]> = [];
    private currentBatchSizeBytes = 0;
    // Aiming for approximately 5-15 MiB, where index performance is optimal
    private readonly MAX_BATCH_SIZE_BYTES = 5 * 1024 * 1024;

    private readonly openSearchBulkService = new OpenSearchBulkService();

    async addToBatch(record: DynamoDBRecord) {
        const processor = EntityProcessorFactory.createProcessor(record);
        if (processor) {
            const request = await processor.prepareBulkRequest(record);

            if (request) {
                const requestSizeBytes = record.dynamodb?.SizeBytes || 0;

                this.batch.push(request);
                this.currentBatchSizeBytes += requestSizeBytes;
            }

            if (this.currentBatchSizeBytes > this.MAX_BATCH_SIZE_BYTES || processor.needsFlush()) {
                await this.flushBatch();
            }
        }
    }

    async flushBatch() {
        if (this.batch.length === 0) {
            return;
        }

        try {
            await this.openSearchBulkService.bulkUpdate(this.batch);
            this.batch = [];
            this.currentBatchSizeBytes = 0;
        } catch (error) {
            console.error('Bulk update failed: ', error);
            // Optionally handle retries or store failed items for reprocessing
        }
    }
}
