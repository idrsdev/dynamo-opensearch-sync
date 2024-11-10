import { DynamoDBRecord } from 'aws-lambda';
import { EventProcessor } from './EventProcessor';

export interface ArrayEntity {
    field: string;
    uniqueAttr: string;
    uniqueIdAttr: string;
}

export abstract class BaseEntityProcessor extends EventProcessor {
    private isFlushRequired: boolean = false;

    /**
     * Mapping of keywords found in an Item's `SK` to corresponding OpenSearch array fields.
     *
     * - `field`: The name of the array field in OpenSearch, e.g., `{ serviceIds: [] }`.
     * - `uniqueAttr`: The unique identifier within each array item, used to uniquely identify items in the array.
     * - `uniqueIdAttr`: The attribute in OpenSearch documents used as the `_id` for each entity.
     *
     * Example:
     * ```typescript
     * SERVICE: { field: 'serviceIds', uniqueAttr: 'serviceId', uniqueIdAttr: 'orderId' }
     * ```
     *
     * @type {Record<string, ArrayEntity>}
     */
    protected arrayEntities: Record<string, ArrayEntity> = {};

    abstract getIndexName(params?: string): string;

    /**
     * Returns the name of the unique identifier field for opensearch documents managed by this processor.
     * @returns {string} The name of the unique ID field, such as `orderId`.
     */
    protected abstract get uniqueIdFieldName(): string;

    /**
     * Determines whether this processor is responsible for handling the provided DynamoDB record.
     * @param {DynamoDBRecord} record - The DynamoDB record to assess.
     * @returns {boolean} True if this processor should handle the record, otherwise false.
     */
    abstract canHandle(record: DynamoDBRecord): boolean;

    needsFlush() {
        return this.isFlushRequired;
    }

    setIsFlushRequired(value: boolean) {
        this.isFlushRequired = value;
    }

    /**
     * Prepares a bulk request for updating documents in OpenSearch.
     * @param {DynamoDBRecord} record - The DynamoDB record to process.
     * @returns {Promise<any | null>} The bulk request payload for OpenSearch, or null.
     */
    async prepareBulkRequest(record: DynamoDBRecord): Promise<[any, any] | null> {
        const eventName = this.getEventName(record);
        const newImage = this.getNewImage(record);
        const oldImage = this.getOldImage(record);

        // Convert DynamoDB Sets to arrays to be handled by OpenSearch
        const oldImageConverted = this.convertSetsToArrays(oldImage);
        const newImageConverted = this.convertSetsToArrays(newImage);

        switch (eventName) {
            case 'INSERT':
            case 'MODIFY':
                const skValue = newImage?.SK || '';
                const arrayEntity = this.getArrayEntitiesFromSK(skValue);

                if (arrayEntity) {
                    return this.createUpdateScriptForArrayItem(newImageConverted, arrayEntity);
                }

                const documentId = newImageConverted[this.uniqueIdFieldName];

                const fieldsToUpsert = this.getFieldsAsScriptParams(oldImageConverted, newImageConverted);
                const fieldsToRemove = this.getDeletedFields(oldImageConverted, newImageConverted);

                const painlessScript = `
                    ${fieldsToUpsert.map((field) => `ctx._source['${field.key}'] = params['${field.key}'];`).join(' ')}
                    ${fieldsToRemove.map((field) => `ctx._source.remove('${field}');`).join(' ')}
                `;

                return [
                    { update: { _index: this.getIndexName(), _id: documentId } },
                    {
                        script: {
                            source: painlessScript,
                            params: fieldsToUpsert.reduce((acc, field) => {
                                acc[field.key] = field.value;
                                return acc;
                            }, {}),
                            lang: 'painless',
                        },
                        upsert: newImageConverted,
                    },
                ];
            case 'DELETE':
                return this.handleDeleteForArrayFields(oldImage);
            default:
                return null;
        }
    }

    getArrayEntitiesFromSK(skValue: string) {
        const keyword = (Object.keys(this.arrayEntities) as Array<keyof typeof this.arrayEntities>).find((key) =>
            skValue.includes(key),
        );
        return keyword ? this.arrayEntities[keyword] : null;
    }

    createUpdateScriptForArrayItem(
        newImageConverted: any,
        arrayEntity: ArrayEntity,
        explicitIndex?: string,
    ): [any, any] | null {
        return [
            {
                update: {
                    _index: explicitIndex ?? this.getIndexName(),
                    _id: newImageConverted[arrayEntity.uniqueIdAttr],
                },
            },
            {
                script: {
                    source: `
                        if (ctx._source.${arrayEntity.field} == null) {
                            ctx._source.${arrayEntity.field} = [];
                            }
                        ctx._source.${arrayEntity.field}.add(params.newItem);
                    `,
                    params: { newItem: newImageConverted },
                },
                upsert: {
                    [arrayEntity.uniqueIdAttr]: newImageConverted[arrayEntity.uniqueIdAttr],
                    [arrayEntity.field]: [newImageConverted],
                } as Record<string, any>,
            },
        ];
    }

    handleDeleteForArrayFields(oldImage: any, explicitIndex?: string): [any, any] | null {
        const skValue = oldImage?.SK || '';
        const arrayEntity = this.getArrayEntitiesFromSK(skValue);

        if (arrayEntity) {
            const id = oldImage[arrayEntity.uniqueAttr];

            const painlessScript = `
                if (ctx._source.${arrayEntity.field} != null) {
                    ctx._source.${arrayEntity.field} = ctx._source.${arrayEntity.field}.removeIf(item -> item.${arrayEntity.uniqueAttr} == params.uniqueId);
                }
            `;

            const actionDefinition = {
                update: {
                    _index: explicitIndex ?? this.getIndexName(),
                    _id: oldImage[arrayEntity.uniqueIdAttr],
                },
            };

            const actionScript = {
                script: {
                    source: painlessScript,
                    params: { uniqueId: id } as Record<string, string>,
                    lang: 'painless',
                },
            };

            return [actionDefinition, actionScript];
        }

        return null;
    }

    convertSetsToArrays(obj: any): any {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (obj instanceof Set) {
            return Array.from(obj);
        }

        if (Array.isArray(obj)) {
            return obj.map((item) => this.convertSetsToArrays(item));
        }

        const convertedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                convertedObj[key] = this.convertSetsToArrays(obj[key]);
            }
        }
        return convertedObj;
    }

    getFieldsAsScriptParams(oldImage: Record<string, any>, newImage: Record<string, any>) {
        const scriptParams: { key: string; value: any }[] = [];

        for (const key in newImage) {
            if (newImage.hasOwnProperty(key)) {
                const oldValue = oldImage ? oldImage[key] : undefined;
                const newValue = newImage[key];

                if (!this.deepEqual(oldValue, newValue)) {
                    scriptParams.push({ key, value: newValue });
                }
            }
        }

        return scriptParams;
    }

    getDeletedFields(oldImage: any, newImage: any): string[] {
        const deletedFields: string[] = [];
        for (const key in oldImage) {
            if (oldImage.hasOwnProperty(key) && !newImage.hasOwnProperty(key)) {
                deletedFields.push(key);
            }
        }
        return deletedFields;
    }

    deepEqual(a: unknown, b: unknown): boolean {
        // Check if types are different
        if (typeof a !== typeof b) return false;

        // Handle primitive types (string, number, boolean, null, undefined)
        if (a === b) return true;

        // Handle special cases
        if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
        if (a instanceof RegExp && b instanceof RegExp) return a.toString() === b.toString();
        if (a instanceof Set && b instanceof Set) return this.deepEqual(Array.from(a), Array.from(b));
        if (a instanceof Map && b instanceof Map)
            return this.deepEqual(Array.from(a.entries()), Array.from(b.entries()));

        // Handle objects and arrays
        if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);

            // Quick length check to fail early if they have different number of keys
            if (keysA.length !== keysB.length) return false;

            // Check that every key in a exists in b and deep compare values
            for (const key of keysA) {
                if (!b.hasOwnProperty(key) || !this.deepEqual(a[key], b[key])) return false;
            }
            return true;
        }

        // If none of the above cases match, return false
        return false;
    }
}
