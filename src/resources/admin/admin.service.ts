const AWS = require("aws-sdk");
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { SearchFilter } from "./admin.controller";
import { DynamoDB } from 'aws-sdk';
import { AttributeMap } from 'aws-sdk/clients/dynamodb';

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

  async getSingleUserByUserId(userId: string) {
    const params = {
      TableName: "users",
      Key: {
        userId: { S: userId }, // Assuming userId is a string, adjust the type if it's different
      },
    };

    try {
      const data = await this.dbClient.getItem(params).promise();
      const user = data.Item;

      if (user) {
        // Exclude the password field from the returned user object
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      }

      return null;
    } catch (error) {
      console.error("Error fetching user by userId:", error);
      throw error;
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

  public async approve(userId: string, approved: string) {
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

  async updateUserProfileInfo(userProfileInfo: AWS.DynamoDB.DocumentClient.AttributeMap) {
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
      this.documentClient.update(params).promise();
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
      TableName: "user_bio_info",
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


  async searchUsers(searchFilter: SearchFilter) {
    const params = {
      TableName: "user_bio_info",
      FilterExpression: this.generateFilterExpression(searchFilter),
      ExpressionAttributeNames: this.generateExpressionAttributeNames(searchFilter),
      ExpressionAttributeValues: this.generateExpressionAttributeValues(searchFilter),
    };

    try {
      const scanResult = await this.dbClient.scan(params).promise();

      if (!scanResult.Items) {
        return [];
      }

      const usersWithPhotos = await Promise.all(
        scanResult.Items.map(async (userBio) => {
          const userBioId = userBio.userBioId.S;
          const photo = userBioId
            ? await this.getUserBioPhotoFromS3(userBioId)
            : null;
          return { ...userBio, photo };
        })
      );

      return usersWithPhotos;
    } catch (error) {
      console.error("Error searching users:", error);
      throw error;
    }
  }


  public async getUserBioPhotoFromS3(
    userBioId: string
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

  generateFilterExpression(searchFilter: SearchFilter): string {
    const conditions = [];
    const attributeNames: AttributeNames = {};
    const attributeValues: AttributeValues = {};

    conditions.push("#approved = :approved");
    attributeNames["#approved"] = "approved";
    attributeValues[":approved"] = { BOOL: true };

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

    if (searchFilter.age) {
      conditions.push("#age = :age");
      attributeNames["#age"] = "age";
      attributeValues[":age"] = { N: searchFilter.age.toString() };
    }

    if (searchFilter.religion) {
      conditions.push("#religion = :religion");
      attributeNames["#religion"] = "religion";
      attributeValues[":religion"] = { S: searchFilter.religion };
    }

    if (searchFilter.ethnicity) {
      conditions.push("#ethnicity = :ethnicity");
      attributeNames["#ethnicity"] = "ethnicity";
      attributeValues[":ethnicity"] = { S: searchFilter.ethnicity };
    }

    if (searchFilter.height) {
      conditions.push("#height = :height");
      attributeNames["#height"] = "height";
      attributeValues[":height"] = { N: searchFilter.height.toString() };
    }

    if (searchFilter.hasChildren !== undefined) {
      conditions.push("#hasChildren = :hasChildren");
      attributeNames["#hasChildren"] = "hasChildren";
      attributeValues[":hasChildren"] = { S: searchFilter.hasChildren };
    }

    if (searchFilter.wantChildren !== undefined) {
      conditions.push("#wantChildren = :wantChildren");
      attributeNames["#wantChildren"] = "wantChildren";
      attributeValues[":wantChildren"] = { S: searchFilter.wantChildren };
    }

    if (searchFilter.profession) {
      conditions.push("#profession = :profession");
      attributeNames["#profession"] = "profession";
      attributeValues[":profession"] = { S: searchFilter.profession };
    }

    if (searchFilter.universityDegreeSubject) {
      conditions.push("#universityDegreeSubject = :universityDegreeSubject");
      attributeNames["#universityDegreeSubject"] = "universityDegreeSubject";
      attributeValues[":universityDegreeSubject"] = { S: searchFilter.universityDegreeSubject };
    }

    if (searchFilter.highestQualification) {
      conditions.push("#highestQualification = :highestQualification");
      attributeNames["#highestQualification"] = "highestQualification";
      attributeValues[":highestQualification"] = { S: searchFilter.highestQualification };
    }

    return conditions.join(" AND ");
  }

  generateExpressionAttributeNames(searchFilter: SearchFilter): AttributeNames {
    const attributeNames: AttributeNames = {};

    attributeNames["#approved"] = "approved";

    if (searchFilter.gender) {
      attributeNames["#gender"] = "gender";
    }

    if (searchFilter.city) {
      attributeNames["#city"] = "city";
    }

    if (searchFilter.age) {
      attributeNames["#age"] = "age";
    }

    if (searchFilter.religion) {
      attributeNames["#religion"] = "religion";
    }

    if (searchFilter.ethnicity) {
      attributeNames["#ethnicity"] = "ethnicity";
    }

    if (searchFilter.height) {
      attributeNames["#height"] = "height";
    }

    if (searchFilter.hasChildren !== undefined) {
      attributeNames["#hasChildren"] = "hasChildren";
    }

    if (searchFilter.wantChildren !== undefined) {
      attributeNames["#wantChildren"] = "wantChildren";
    }

    if (searchFilter.profession) {
      attributeNames["#profession"] = "profession";
    }

    if (searchFilter.universityDegreeSubject) {
      attributeNames["#universityDegreeSubject"] = "universityDegreeSubject";
    }

    if (searchFilter.highestQualification) {
      attributeNames["#highestQualification"] = "highestQualification";
    }

    return attributeNames;
  }

  generateExpressionAttributeValues(searchFilter: SearchFilter): AttributeValues {
    const attributeValues: AttributeValues = {};

    attributeValues[":approved"] = { BOOL: true };

    if (searchFilter.gender) {
      attributeValues[":gender"] = { S: searchFilter.gender };
    }

    if (searchFilter.city) {
      attributeValues[":city"] = { S: searchFilter.city };
    }

    if (searchFilter.age) {
      attributeValues[":age"] = { N: searchFilter.age.toString() };
    }

    if (searchFilter.religion) {
      attributeValues[":religion"] = { S: searchFilter.religion };
    }

    if (searchFilter.ethnicity) {
      attributeValues[":ethnicity"] = { S: searchFilter.ethnicity };
    }

    if (searchFilter.height) {
      attributeValues[":height"] = { N: searchFilter.height.toString() };
    }

    if (searchFilter.hasChildren !== undefined) {
      attributeValues[":hasChildren"] = { S: searchFilter.hasChildren };
    }

    if (searchFilter.wantChildren !== undefined) {
      attributeValues[":wantChildren"] = { S: searchFilter.wantChildren };
    }

    if (searchFilter.profession) {
      attributeValues[":profession"] = { S: searchFilter.profession };
    }

    if (searchFilter.universityDegreeSubject) {
      attributeValues[":universityDegreeSubject"] = { S: searchFilter.universityDegreeSubject };
    }

    if (searchFilter.highestQualification) {
      attributeValues[":highestQualification"] = { S: searchFilter.highestQualification };
    }

    return attributeValues;
  }
}







