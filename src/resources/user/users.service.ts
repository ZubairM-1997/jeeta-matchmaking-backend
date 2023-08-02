const AWS = require("aws-sdk");
import DynamoDB, { PutItemInputAttributeMap } from "aws-sdk/clients/dynamodb";

import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";

export default class UserService {
  public dbClient: AWS.DynamoDB;
  public s3Client: AWS.S3;
  private documentClient: AWS.DynamoDB.DocumentClient;

  constructor(dbClient: AWS.DynamoDB, s3Client: AWS.S3) {
    this.dbClient = dbClient;
    this.s3Client = s3Client;
    this.documentClient = new DynamoDB.DocumentClient();
  }

  // these functions will directly call dynamoDb to implement the right queries

  async getSingleUserByUserId(userId: string) {
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

  }

  async getSingleUserByEmail(email: string){
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


  public async createUser(username: string, email: string, password: string) {
    const existingUser = await this.getSingleUserByEmail(email);
    console.log(existingUser)
    if (existingUser?.length !== 0) {
      throw new Error("User with this email already exists.");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create a new user object
    const user = {
      userId: { S: uuidv4() },
      username: { S: username },
      email: { S: email },
      password: { S: hashedPassword },
    };

    const params = {
      TableName: "users",
      Item: user,
    };

    try {
      // Save the user to DynamoDB
      await this.dbClient.putItem(params).promise();
      console.log("User created successfully.");
      return user;
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  }

  async saveApplication(
    userId: string,
    firstName: string,
    lastName: string,
    birthday: string,
    mobileNumber: string,
    country: string,
    address: string,
    gender: string,
    height: string,
    ethnicity: string,
    religion: string,
    practicing: string,
    marital_status: string,
    wantChildren: string,
    hasChildren: string,
    universityDegree: string,
    profession: string,
    howDidYouLearnAboutUs: string,
    photo: Buffer,
    city: string,
    annualIncome?: number,
    netWorth?: number,
  ) {
    const userBioId = uuidv4();
    const fullName = firstName + ' ' + lastName;
    const fullAddress = address + "," + city + "," + country

    const annualIncomeStr = annualIncome !== undefined ? annualIncome.toString() : null;
    const netWorthStr = netWorth !== undefined ? netWorth.toString() : null;
    const dobParts = birthday.split("/");
    if (dobParts.length !== 3) {
      // Handle invalid birthday format here
      // For example, throw an error or return an appropriate response
      throw new Error("Invalid birthday format");
    }

    const userBirthDate = new Date(`${dobParts[2]}-${dobParts[1]}-${dobParts[0]}`);
    const today = new Date();
    let age = today.getFullYear() - userBirthDate.getFullYear();
    const monthDifference = today.getMonth() - userBirthDate.getMonth();

    if (
      monthDifference < 0 ||
      (monthDifference === 0 && today.getDate() < userBirthDate.getDate())
    ) {
      age--; // Reduce age if the user hasn't celebrated the birthday yet this year
    }

    const basicInfo : PutItemInputAttributeMap = {
      userBioId: {S: userBioId},
      userId: {S: userId},
      fullName: {S: fullName},
      birthday: {S: birthday},
      mobileNumber: {S: mobileNumber},
      address: {S: fullAddress},
      gender: {S: gender},
      height: {S: height},
      age: {S: age.toString()},
      religion: {S: religion},
      practicing: {S: practicing},
      ethnicity: {S: ethnicity},
      marital_status: {S: marital_status},
      wantChildren: {S: wantChildren},
      hasChildren: {S: hasChildren},
      howDidYouLearnAboutUs: {S: howDidYouLearnAboutUs},
      universityDegree: {S: universityDegree},
      annualIncome: annualIncomeStr ? { N: annualIncomeStr } : { NULL: true }, // Use { NULL: true } for undefined values
      netWorth: netWorthStr ? { N: netWorthStr } : { NULL: true },
      profession: {S: profession},
      approved: { BOOL: false },
    }


    const bioInfoParams: AWS.DynamoDB.PutItemInput = {
      TableName: "user_bio_info",
      Item: basicInfo,
    };


    try {

      await this.dbClient.putItem(bioInfoParams).promise();
      console.log("User information has successfully been saved")

      await this.uploadPhotoToS3(userBioId, photo);
    } catch (error) {
      console.error("Error saving user bio:", error);
      throw error;
    }
  }


  async amend(
    userId: string,
    fullName: string,
    mobileNumber: string,
    fullAddress: string,
    gender: string,
    height: string,
    ethnicity: string,
    religion: string,
    practicing: string,
    marital_status: string,
    wantChildren: string,
    universityDegree: string,
    profession: string,
    howDidYouLearnAboutUs: string,
    birthday: string,
    photo: Buffer,
  ): Promise<void> {
    try {
     // Get the existing user profile info by userId
     const userProfileInfo = await this.getUserProfileInfoByUserId(userId);

     if (!userProfileInfo) {
       throw new Error("User profile not found.");
     }

     // Update the user profile attributes
     userProfileInfo.fullName = fullName;
     userProfileInfo.mobileNumber = mobileNumber;
     userProfileInfo.address = fullAddress;
     userProfileInfo.gender = gender;
     userProfileInfo.height = height;
     userProfileInfo.ethnicity = ethnicity;
     userProfileInfo.religion = religion;
     userProfileInfo.practicing = practicing;
     userProfileInfo.marital_status = marital_status;
     userProfileInfo.wantChildren = wantChildren;
     userProfileInfo.universityDegree = universityDegree;
     userProfileInfo.profession = profession; // Updated attribute name
     userProfileInfo.howDidYouLearnAboutUs = howDidYouLearnAboutUs;
     userProfileInfo.birthday = birthday;

     // Update the user profile info in DynamoDB
     await this.updateUserProfileInfo(userProfileInfo);

     // Update the photo in S3 using the correct userBioId
    //  await this.updatePhotoInS3(userProfileInfo.userBioId.S, photo);

     console.log("User profile info and photo updated successfully.");
      // console.log("User photo updated in S3 successfully.");
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
        fullName = :fullName,
        mobileNumber = :mobileNumber,
        address = :address,
        gender = :gender,
        height = :height,
        ethnicity = :ethnicity,
        religion = :religion,
        practicing = :practicing,
        marital_status = :marital_status,
        wantChildren = :wantChildren,
        universityDegree = :universityDegree,
        profession = :profession,
        howDidYouLearnAboutUs = :howDidYouLearnAboutUs,
        birthday = :birthday`,
      ExpressionAttributeValues: {
        ":fullName": userProfileInfo.fullName,
        ":mobileNumber": userProfileInfo.mobileNumber,
        ":address": userProfileInfo.address,
        ":gender": userProfileInfo.gender,
        ":height": userProfileInfo.height,
        ":ethnicity": userProfileInfo.ethnicity,
        ":religion": userProfileInfo.religion,
        ":practicing": userProfileInfo.practicing,
        ":marital_status": userProfileInfo.marital_status,
        ":wantChildren": userProfileInfo.wantChildren,
        ":universityDegree": userProfileInfo.universityDegree,
        ":profession": userProfileInfo.profession,
        ":howDidYouLearnAboutUs": userProfileInfo.howDidYouLearnAboutUs,
        ":birthday": userProfileInfo.birthday,
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


  async updatePhotoInS3(userBioId: string, photo: Buffer): Promise<void> {
    const photoKey = userBioId; // Change the extension based on the photo type

    const params: AWS.S3.PutObjectRequest = {
      Bucket: "user-bio-pics", // Replace with the actual name of your S3 bucket
      Key: photoKey,
      Body: photo,
    };

    try {
      // Upload the new photo to S3
      await this.s3Client.putObject(params).promise();
      console.log("New photo uploaded to S3 successfully.");
    } catch (error) {
      console.error("Error uploading new photo to S3:", error);
      throw error;
    }
  }


  private async uploadPhotoToS3(userBioId: string, photo: Buffer) {
    // Prepare the parameters for S3 PutObject operation
    const params = {
      Bucket: "user-bio-pics", // Replace with the name of your S3 bucket
      Key: userBioId, // Use the userBioId as the key for the S3 object to associate it with the user bio
      Body: photo, // The photo data you want to upload (e.g., a Buffer or a ReadableStream)
      ContentType: "image/jpeg", // Adjust the content type based on the type of photo you are uploading
      // You can also add additional metadata or ACL settings as needed.
    };

    try {
      await this.s3Client.putObject(params).promise();
      console.log("Photo uploaded to S3 successfully.");
    } catch (error) {
      console.error("Error uploading photo to S3:", error);
      throw error;
    }
  }
}
