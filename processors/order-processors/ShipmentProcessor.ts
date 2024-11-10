import { BaseEntityProcessor } from '@/processors/BaseEntityProcessor';
import { DynamoDBRecord } from 'aws-lambda';

export class ShipmentProcessor extends BaseEntityProcessor {
    getIndexName(): string {
        return 'orders';
    }

    protected get uniqueIdFieldName(): string {
        return 'orderId';
    }

    canHandle(record: DynamoDBRecord): boolean {
        const sk = record.dynamodb?.Keys?.SK.S || '';
        return sk.startsWith('SHIPMENT#');
    }

    prepareBulkRequest(record: DynamoDBRecord): any {
        const eventName = this.getEventName(record);

        const newImage = this.convertSetsToArrays(this.getNewImage(record));
        const documentId = newImage[this.uniqueIdFieldName];

        switch (eventName) {
            case 'INSERT':
            case 'MODIFY': {
                return [
                    { update: { _index: this.getIndexName(), _id: documentId } },

                    {
                        doc: {
                            shipmentInfo: newImage,
                        },
                        doc_as_upsert: true,
                    },
                ];
            }
            default:
                return null;
        }
    }
}
