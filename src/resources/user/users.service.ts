const AWS = require("aws-sdk");
import DynamoDB, { DocumentClient, PutItemInputAttributeMap } from "aws-sdk/clients/dynamodb";
import { UploadedFile } from 'express-fileupload'

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

  async getUserByGoogleSub(sub: string): Promise<AWS.DynamoDB.DocumentClient.AttributeMap | null> {
    const params: DocumentClient.ScanInput = {
      TableName: "users", // Replace with your DynamoDB table name
      FilterExpression: "googleSub = :subValue",
      ExpressionAttributeValues: {
        ":subValue":  sub,
      },
    };

    try {
      const data = await this.documentClient.scan(params).promise();
      if (data.Items && data.Items.length > 0) {
        return data.Items[0] as AWS.DynamoDB.DocumentClient.AttributeMap;
      } else {
        return null; // Return null if no matching item found
      }
    } catch (error) {
      console.error("Error scanning users by Google sub:", error);
      throw error;
    }
  }

  async createUserFromGoogle(sub: string, email: string, username: string): Promise<AWS.DynamoDB.DocumentClient.AttributeMap | null> {
    const existingUser = await this.getUserByGoogleSub(sub);

    if (existingUser) {
      return existingUser;
    }

    const user = {
      userId: uuidv4(),
      username: username ,
      email: email ,
      googleSub: sub ,
    };

    const params = {
      TableName: "users", // Replace with your DynamoDB table name
      Item: user,
    };

    try {
      // Save the user to DynamoDB
      await this.documentClient.put(params).promise();
      console.log("User created from Google successfully.");
      return user;
    } catch (error) {
      console.error("Error creating user from Google:", error);
      throw error;
    }
  }

  genereateS3Url = async (
    userBioId: string,
  ) => {
    const params = {
      Bucket: "user-bio-pics", // Replace with the name of your S3 bucket
      Key: userBioId, // Use the userBioId as the key for the S3 object to associate it with the user bio
    };

    const uploadURL = this.s3Client.getSignedUrl('putObject' ,params)
    return uploadURL
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

  public async loginUser(email: string, password: string): Promise<AWS.DynamoDB.DocumentClient.AttributeMap | null> {
    try {
      // Get the user with the specified email from DynamoDB
      const users = await this.getSingleUserByEmail(email);

      if (users && users.length > 0) {
        const user = users[0];
        const hashedPassword = user.password.S as string; // Assuming the password attribute is stored as a string

        // Compare the hashed password with the input password using bcrypt
        const passwordMatch = await bcrypt.compare(password, hashedPassword);

        if (passwordMatch) {
          // If passwords match, return the user data (without the password attribute)
          const { password, ...userDataWithoutPassword } = user;
          return userDataWithoutPassword;
        }
      }

      // If the user is not found or passwords don't match, return null
      return null;
    } catch (error) {
      console.error("Error during user login:", error);
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
    universityDegreeSubject: string,
    highestQualification: string,
    profession: string,
    howDidYouLearnAboutUs: string,
    city: string,
    contactPreference: string,
    consultationPreference: string,
    consent: string,
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
      city: {S: city.toLowerCase()},
      gender: {S: gender.toLowerCase()},
      height: {S: height},
      age: {S: age.toString()},
      religion: {S: religion.toLowerCase()},
      practicing: {S: practicing.toLowerCase()},
      ethnicity: {S: ethnicity.toLowerCase()},
      marital_status: {S: marital_status.toLowerCase()},
      wantChildren: {S: wantChildren.toLowerCase() },
      hasChildren: {S: hasChildren.toLowerCase() },
      howDidYouLearnAboutUs: {S: howDidYouLearnAboutUs.toLowerCase()},
      universityDegreeSubject: {S: universityDegreeSubject.toLowerCase()},
      highestQualification: {S: highestQualification.toLocaleLowerCase()},
      annualIncome: annualIncomeStr ? { N: annualIncomeStr } : { NULL: true },
      netWorth: netWorthStr ? { N: netWorthStr } : { NULL: true },
      profession: {S: profession.toLowerCase()},
      approved: { BOOL: false },
      contactPreference: {S: contactPreference},
      consultationPreference: {S: consultationPreference},
      consent: {S: consent}
    }


    const bioInfoParams: AWS.DynamoDB.PutItemInput = {
      TableName: "user_bio_info",
      Item: basicInfo,
    };

    try {

      await this.dbClient.putItem(bioInfoParams).promise();
      console.log("User information has successfully been saved")
      return {
        userBioId,
        userId
      }

    } catch (error) {
      console.error("Error saving user bio:", error);
      throw error;
    }
  }


  async amend(
    userId: string,
    mobileNumber: string,
    fullAddress: string,
    gender: string,
    height: string,
    ethnicity: string,
    religion: string,
    practicing: string,
    marital_status: string,
    wantChildren: string,
    hasChildren: string,
    universityDegreeSubject: string,
    highestQualification: string,
    profession: string,
    photo: Buffer,
  ): Promise<string> {
    try {
     // Get the existing user profile info by userId
     const userProfileInfo = await this.getUserProfileInfoByUserId(userId);

     if (!userProfileInfo) {
       throw new Error("User profile not found.");
     }

     // Update the user profile attributes
     userProfileInfo.hasChildren = hasChildren;
     userProfileInfo.mobileNumber = mobileNumber;
     userProfileInfo.address = fullAddress;
     userProfileInfo.gender = gender.toLowerCase();
     userProfileInfo.height = height;
     userProfileInfo.ethnicity = ethnicity.toLowerCase();
     userProfileInfo.religion = religion.toLowerCase();
     userProfileInfo.practicing = practicing.toLowerCase();
     userProfileInfo.marital_status = marital_status.toLowerCase();
     userProfileInfo.wantChildren = wantChildren.toLowerCase();
     userProfileInfo.universityDegreeSubject = universityDegreeSubject.toLowerCase();
     userProfileInfo.highestQualification = highestQualification.toLowerCase();
     userProfileInfo.profession = profession.toLowerCase()

     // Update the user profile info in DynamoDB
     await this.updateUserProfileInfo(userProfileInfo);
     console.log("User profile info successfully.");

     // Update the photo in S3 using the correct userBioId
     const url = await this.updatePhotoInS3(userProfileInfo.userBioId, photo);

     return url;

      // console.log("User photo updated in S3 successfully.");
    } catch (error) {
      console.error("Error amending application:", error);
      throw error;
    }
  }

  async updateUserProfileInfo(userProfileInfo: AWS.DynamoDB.DocumentClient.AttributeMap): Promise<void> {

    console.log({
      userId: userProfileInfo.userId,
      userBioId: userProfileInfo.userBioId
    })

    const params: AWS.DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: "user_bio_info",
      Key: { userId: userProfileInfo.userId, userBioId: userProfileInfo.userBioId  },
      UpdateExpression: `SET
        mobileNumber = :mobileNumber,
        address = :address,
        gender = :gender,
        height = :height,
        ethnicity = :ethnicity,
        religion = :religion,
        practicing = :practicing,
        marital_status = :marital_status,
        wantChildren = :wantChildren,
        hasChildren = :hasChildren,
        universityDegreeSubject = :universityDegreeSubject,
        profession = :profession,
        highestQualification = :highestQualification`,
      ExpressionAttributeValues: {
        ":mobileNumber": userProfileInfo.mobileNumber,
        ":address": userProfileInfo.address,
        ":gender": userProfileInfo.gender,
        ":height": userProfileInfo.height,
        ":ethnicity": userProfileInfo.ethnicity,
        ":religion": userProfileInfo.religion,
        ":practicing": userProfileInfo.practicing,
        ":marital_status": userProfileInfo.marital_status,
        ":wantChildren": userProfileInfo.wantChildren,
        ":hasChildren": userProfileInfo.hasChildren,
        ":universityDegreeSubject": userProfileInfo.universityDegreeSubject,
        ":profession": userProfileInfo.profession,
        ":highestQualification": userProfileInfo.highestQualification,

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


  async updatePhotoInS3(userBioId: string, photo: Buffer): Promise<string> {
    const photoKey = userBioId; // Change the extension based on the photo type

    const previousPhotoParams: AWS.S3.GetObjectRequest = {
      Bucket: "user-bio-pics", // Replace with the actual name of your S3 bucket
      Key: photoKey,
    };

    try {
      await this.s3Client.headObject(previousPhotoParams).promise();

      const deleteParams: AWS.S3.DeleteObjectRequest = {
        Bucket: "user-bio-pics",
        Key: photoKey,
      };
      await this.s3Client.deleteObject(deleteParams).promise();
      console.log("Previous picture deleted successfully")
    } catch (error) {
        console.error("Error deleting previous photo from S3:", error);
        throw error;

    }

    return await this.genereateS3Url(userBioId)
  }

  async saveResetToken(userId: string, resetToken: string, resetTokenExpires: number) {
    const params = {
      TableName: 'users',
      Key: { userId: userId },
      UpdateExpression: 'SET resetToken = :token, resetTokenExpires = :expires',
      ExpressionAttributeValues: {
        ':token': resetToken,
        ':expires': resetTokenExpires,
      },
    };

    try {
      await this.documentClient.update(params).promise();
      console.log("Reset token and expiration timestamp updated in DynamoDB successfully.");
    } catch (error) {
      console.error("Error updating reset token and expiration timestamp", error);
      throw error;
    }
  }

  async updatePassword(userId: string, newPassword: string): Promise<boolean> {
    try {
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      const params = {
        TableName: 'users',
        Key: { userId: userId },
        UpdateExpression: 'SET password = :password, resetToken = :removeToken, resetTokenExpires = :removeExpires',
        ExpressionAttributeValues: {
          ':password': hashedPassword,
          ':removeToken': null, // Remove reset token
          ':removeExpires': null, // Remove reset token expiration timestamp
        },
      };

      await this.documentClient.update(params).promise();
      return true; // Password updated successfully
    } catch (error) {
      console.error("Error updating password:", error);
      throw error;
    }
  }

  async validateResetToken(token: string, userId: string): Promise<boolean> {
    try {
      const params = {
        TableName: 'users',
        Key: { userId: userId },
        ProjectionExpression: 'resetToken, resetTokenExpires',
      };

      const data = await this.documentClient.get(params).promise();
      const user = data.Item;

      if (user && user.resetToken && user.resetTokenExpires) {
        const resetToken = user.resetToken as string;
        const resetTokenExpires = user.resetTokenExpires as number;
        const now = Math.floor(Date.now() / 1000);

        if (resetToken === token && now <= resetTokenExpires) {
          return true; // Token is valid
        }
      }

      return false; // Token is invalid or expired
    } catch (error) {
      console.error("Error validating reset token:", error);
      throw error;
    }
  }



}
