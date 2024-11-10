import { DynamoDBRecord } from "aws-lambda";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { AttributeValue } from "@aws-sdk/client-dynamodb";

export abstract class EventProcessor {
  abstract prepareBulkRequest(record: DynamoDBRecord);

  protected getEventName(record: DynamoDBRecord): string | undefined {
    return record.eventName;
  }

  protected getNewImage(record: DynamoDBRecord) {
    const newImage = record.dynamodb?.NewImage;
    return newImage
      ? unmarshall(newImage as AttributeValue | Record<string, AttributeValue>)
      : {};
  }

  protected getOldImage(record: DynamoDBRecord): Record<string, any> {
    const OldImage = record.dynamodb?.OldImage;
    return OldImage
      ? unmarshall(OldImage as AttributeValue | Record<string, AttributeValue>)
      : {};
  }
}
