import AWS from "aws-sdk";

AWS.config.update({
	accessKeyId: process.env.AWS_ACCESS_KEY_ID as string,
	secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY as string,
	region: "eu-north-1"
});

export const dynamodb = new AWS.DynamoDB();


