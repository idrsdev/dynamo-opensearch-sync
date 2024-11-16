## Table of Contents
1. [Stream Architecture](#stream-architecture)
2. [Local Testing](#local-testing)
   
# Stream Architecture

This repository contains the DynamoDB stream processing logic for entities like user, order etc, as well as integration with services like OpenSearch. Below is the breakdown of the folder structure.

## 📦 Folder Structure

### `handlers`

Contains Lambda handlers and entry points.

- **StreamBatchHandler.ts**: Lambda handler responsible for processing a batch of records.

### `processors`

Contains the core processing logic.

- **BaseEntityProcessor.ts**: Base class for all entity processors, providing shared functionality for processing records.
- **BatchProcessor.ts**: Logic for batching records for efficient processing.
- **EntityProcessorFactory.ts**: Factory pattern for creating and delegating to appropriate entity processors based on record types.
- **EventProcessor.ts**: Handles processing specific to events.

#### `entity-processors`

Processors based on the partition key (PK). These are high-level processors responsible for deciding which specific entity processor to delegate to.

- **OrderEntityProcessor.ts**: Processor for handling order-related entities.
- **UserEntityProcessor.ts**: Processor for handling user-related entities.
  - _The same structure applies for future entities to be added._

#### `order-processors`

Processors specific to service requests based on the sort key (SK). These processors are categorized by specific features or types within service requests.

- _And any future processors to be added._

### `services`

Contains services related to external integrations, such as OpenSearch.

- **OpenSearchBulkService.ts**: Service handling bulk operations for OpenSearch.

### Root files

- **event.json**: A sample event file used for testing.
- **index.ts**: The main entry point of the application.

# Local Testing

`npm i --registry=https://registry.npmjs.org/`

`cp parameters.example.json parameters.json`

provide the required values in the parameters.json

Run the following command to invoke this function using the test event:

    sam build LogisticsStreamCallbackFunction && sam local invoke LogisticsStreamCallbackFunction --event "event.json" --env-vars parameters.json

> **Note**: Use this repository **at your own discretion**, especially for production use. This repository is provided as-is, and caution should be exercised when adapting it for live or production environments. Misconfigurations or improper usage could lead to data inconsistencies or other issues.

