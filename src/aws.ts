import AWS from "aws-sdk";
import dotenv from "dotenv";
dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
  region: "eu-north-1"
});

export const dynamodb = new AWS.DynamoDB();
export const s3Client = new AWS.S3();
