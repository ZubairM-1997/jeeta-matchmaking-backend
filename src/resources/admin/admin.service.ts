const AWS = require("aws-sdk");
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { SearchFilter } from "./admin.controller";
import { DynamoDB } from 'aws-sdk';

interface AttributeNames {
  [key: string]: string;
}

interface AttributeValues {
  [key: string]: AWS.DynamoDB.AttributeValue;
}

export default class AdminService {
  dbClient: AWS.DynamoDB;
  s3Client: AWS.S3;
  documentClient: DynamoDB.DocumentClient;

  constructor(dbClient: AWS.DynamoDB, s3Client: AWS.S3) {
    this.dbClient = dbClient;
    this.s3Client = s3Client;
    this.documentClient = new DynamoDB.DocumentClient();
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

  async getUserProfileInfoByUserId(userId: string): Promise<AWS.DynamoDB.DocumentClient.AttributeMap | null> {
    const params: AWS.DynamoDB.DocumentClient.QueryInput = {
      TableName: "user_bio_info",
      KeyConditionExpression: "userId = :uid",
      ExpressionAttributeValues: {
        ":uid": userId,
      },
      Limit: 1, // Since userId is unique, we can limit the result to 1 item
    };

    try {
      const result = await this.documentClient.query(params).promise();
      if (result.Items && result.Items.length > 0) {
        return result.Items[0] as AWS.DynamoDB.DocumentClient.AttributeMap;
      } else {
        return null; // Return null if no matching item found
      }
    } catch (error) {
      console.error("Error fetching user profile info:", error);
      throw error;
    }
  }

  public async approve(userId: string, approved: string): Promise<void> {
    try {
      const userProfileInfo = await this.getUserProfileInfoByUserId(userId);

      if (!userProfileInfo) {
        throw new Error("User profile not found.");
      }

      userProfileInfo.approved = approved;

      await this.updateUserProfileInfo(userProfileInfo);

    } catch (error) {
      console.error("Error amending application:", error);
      throw error;
    }
  }

  async updateUserProfileInfo(userProfileInfo: AWS.DynamoDB.DocumentClient.AttributeMap): Promise<void> {
    const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: "user_bio_info",
      Key: { userId: userProfileInfo.userId, userBioId: userProfileInfo.userBioId  },
      UpdateExpression: `SET
        approved = :approved`,
      ExpressionAttributeValues: {
        ":approved": userProfileInfo.approved,
      },
    };

    try {
      await this.documentClient.update(params).promise();
      console.log("User profile info updated in DynamoDB successfully.");
    } catch (error) {
      console.error("Error updating user profile info:", error);
      throw error;
    }
  }


  async getSingleAdminByUsername(username: string){
    const params = {
      TableName: "admins",
      FilterExpression: "username = :usernameValue",
      ExpressionAttributeValues: {
        ":usernameValue": { S: username },
      },
    };
    try {
      const data = await this.dbClient.scan(params).promise();
      return data.Items; // This will contain an array of users with the specified email if found, otherwise an empty array
    } catch (error) {
      console.error("Error scanning admin by username:", error);
      throw error;
    }
  }

  public async createAdmin(username: string, password: string) {
    const existingAdmin = await this.getSingleAdminByUsername(username);
    if (existingAdmin?.length !== 0) {
      return null;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user object
    const admin = {
      adminId: { S: uuidv4() },
      username: { S: username },
      password: { S: hashedPassword },
    };

    const params = {
      TableName: "admins",
      Item: admin,
    };

    try {
      // Save the user to DynamoDB
      await this.dbClient.putItem(params).promise();
      console.log("Admin created successfully.");
      return admin;
    } catch (error) {
      console.error("Error creating Admin:", error);
      throw error;
    }
  }

  public async loginAdmin(username: string, password: string): Promise<AWS.DynamoDB.DocumentClient.AttributeMap | null> {
    try {
      const admin = await this.getSingleAdminByUsername(username);

      if (admin && admin.length > 0) {
        const adminFound = admin[0];
        const hashedPassword = adminFound.password?.S as string | undefined;

        if (hashedPassword) {
          const passwordMatch = await bcrypt.compare(password, hashedPassword);

          if (passwordMatch) {
            const { password, ...adminDataWithoutPassword } = adminFound;
            console.log(adminDataWithoutPassword)
            return adminDataWithoutPassword;
          }
        }
      }

      // If the user is not found or passwords don't match, return null
      return null;
    } catch (error) {
      console.error("Error during admin login:", error);
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
