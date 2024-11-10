import { Client } from "@opensearch-project/opensearch";

export class OpenSearchBulkService {
  private readonly client = new Client({
    node: process.env.OPENSEARCH_CONFIGURATION,
  });

  async bulkUpdate(bulkRequestBody: Array<[any, any]>) {
    try {
      const { validOperations, skippedOperations } =
        this.validateAndFlattenBulkOperations(bulkRequestBody);

      if (validOperations.length === 0) {
        console.error(
          "No valid items to process in bulk update - all operations are missing required fields"
        );
        return;
      }

      if (skippedOperations.length > 0) {
        console.warn(
          "Skipped operations due to missing fields:",
          JSON.stringify(skippedOperations, null, 2)
        );
      }

      const bulkResponse = await this.client.bulk({
        body: validOperations,
      });

      console.log(`INFO: OpenSearch Took ${bulkResponse?.body?.took} ms`);

      if (bulkResponse.warnings) {
        console.error("OpenSearch WARNINGS:", bulkResponse.warnings);
      }

      const errors = bulkResponse?.body?.items?.filter(
        (item) => item.update?.error
      );
      if (errors && errors.length > 0) {
        console.error("OpenSearch BULK OPERATION ERRORS:", errors);
      }
    } catch (error) {
      console.error(JSON.stringify(error, null, 2));
    }
  }

  /**
   * Validates a nested bulk request body to ensure each operation pair has the necessary fields
   * in the 'update' action (specifically '_index' and '_id').
   */
  validateAndFlattenBulkOperations(bulkRequestBody: Array<[any, any]>): {
    validOperations: any[];
    skippedOperations: any[];
  } {
    const validOperations: any[] = [];
    const skippedOperations: any[] = [];

    bulkRequestBody.forEach((operationPair, index) => {
      const action = operationPair[0];
      const data = operationPair[1];

      if (action.update && action.update._index && action.update._id) {
        validOperations.push(action, data);
      } else {
        skippedOperations.push({
          index,
          reason: `Missing '_index' or '_id' in operation`,
          operation: JSON.stringify(operationPair, null, 1),
        });
      }
    });

    return { validOperations, skippedOperations };
  }
}
