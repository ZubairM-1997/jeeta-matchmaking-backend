import { DynamoDB, S3 } from "aws-sdk";
import { SearchFilter } from "./admin.controller";

interface AttributeNames {
  [key: string]: string;
}

interface AttributeValues {
  [key: string]: DynamoDB.AttributeValue;
}

export default class AdminService {
  public dbClient: DynamoDB;
  public s3Client: S3;

  constructor(dbClient: DynamoDB, s3Client: S3) {
    this.dbClient = dbClient;
    this.s3Client = s3Client;
  }

  async getSingleUser(userId?: string, email?: string) {
    if (userId && !email) {
      // Search by userId
      const params = {
        TableName: "users",
        Key: {
          userId: { S: userId }, // Assuming userId is a string, adjust the type if it's different
        },
      };

      try {
        const data = await this.dbClient.getItem(params).promise();
        return data.Item; // This will contain the user with the specified userId if found, otherwise null
      } catch (error) {
        console.error("Error fetching user by userId:", error);
        throw error;
      }
    } else if (email && !userId) {
      // Search by email
      const params = {
        TableName: "users",
        FilterExpression: "email = :emailValue",
        ExpressionAttributeValues: {
          ":emailValue": { S: email },
        },
      };

      try {
        const data = await this.dbClient.scan(params).promise();
        return data.Items; // This will contain an array of users with the specified email if found, otherwise an empty array
      } catch (error) {
        console.error("Error scanning users by email:", error);
        throw error;
      }
    } else {
      throw new Error("Either userId or email must be provided.");
    }
  }

  async approve(userId: string, approved: boolean): Promise<void> {
    try {
      // Fetch the user's profile info from the database
      const params: DynamoDB.DocumentClient.GetItemInput = {
        TableName: "user_bios",
        Key: {
          userId: { S: userId },
        },
      };

      const result = await this.dbClient.getItem(params).promise();
      const userProfileInfo =
        result.Item as DynamoDB.DocumentClient.AttributeMap | null;

      if (!userProfileInfo) {
        throw new Error("User profile info not found");
      }

      // Update the approved field in the user bio
      userProfileInfo.approved = approved;

      // Save the updated user profile info back to the database
      const updateParams: DynamoDB.DocumentClient.PutItemInput = {
        TableName: "user_bios",
        Item: userProfileInfo,
      };

      await this.dbClient.putItem(updateParams).promise();
      console.log("User profile info updated successfully.");
    } catch (error) {
      console.error("Error approving application:", error);
      throw error;
    }
  }

  public async getAllUsers() {
    const params = {
      TableName: "user_bios",
    };

    try {
      // Perform the DynamoDB Scan operation to fetch all user_bios
      const scanResult = await this.dbClient.scan(params).promise();

      // Iterate through each user_bio and fetch the corresponding photo from S3
      if (scanResult.Items) {
        // Iterate through each user_bio and fetch the corresponding photo from S3
        const usersWithPhotos = await Promise.all(
          scanResult.Items.map(async (userBio) => {
            const userBioId = userBio.userBioId.S;
            const photo = userBioId
              ? await this.getUserBioPhotoFromS3(userBioId)
              : null;
            return { ...userBio, photo };
          }),
        );

        return usersWithPhotos;
      } else {
        // Handle the case where scanResult.Items is undefined (no items found in the scan)
        console.warn("No user_bios found in the DynamoDB table.");
        return [];
      }
    } catch (error) {
      console.error("Error fetching all users:", error);
      throw error;
    }
  }

  private async getUserBioPhotoFromS3(
    userBioId: string,
  ): Promise<string | null> {
    // Prepare the parameters for S3 GetObject operation
    const params = {
      Bucket: "user-bio-pics", // Replace with the name of your S3 bucket
      Key: userBioId,
    };

    try {
      // Fetch the photo from S3
      const data = await this.s3Client.getObject(params).promise();
      return data.Body?.toString("base64") || null;
    } catch (error) {
      // If the photo is not found in S3 or any other error occurs, return null
      console.error(`Error fetching photo for userBioId: ${userBioId}`, error);
      return null;
    }
  }

  async searchUsers(searchFilter: SearchFilter) {
    const params = {
      TableName: "user_bios",
      FilterExpression: this.generateFilterExpression(searchFilter),
      ExpressionAttributeValues:
        this.generateExpressionAttributeValues(searchFilter),
    };

    try {
      const scanResult = await this.dbClient.scan(params).promise();

      return scanResult.Items || [];
    } catch (error) {
      console.error("Error searching users:", error);
      throw error;
    }
  }

  generateFilterExpression(searchFilter: SearchFilter): string {
    const conditions = [];
    const attributeNames: AttributeNames = {};
    const attributeValues: AttributeValues = {};

    if (searchFilter.gender) {
      conditions.push("#gender = :gender");
      attributeNames["#gender"] = "gender";
      attributeValues[":gender"] = { S: searchFilter.gender };
    }

    if (searchFilter.city) {
      conditions.push("#city = :city");
      attributeNames["#city"] = "city";
      attributeValues[":city"] = { S: searchFilter.city };
    }

    return conditions.join(" AND ");
  }

  generateExpressionAttributeValues(searchFilter: SearchFilter) {
    const attributeValues: AttributeValues = {};

    if (searchFilter.gender) {
      attributeValues[":gender"] = { S: searchFilter.gender };
    }

    if (searchFilter.city) {
      attributeValues[":city"] = { S: searchFilter.city };
    }

    return attributeValues;
  }
}
