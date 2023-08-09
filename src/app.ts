import express, { Application } from "express";
import fileUpload from 'express-fileupload'
import cors from "cors";
import bodyParser from "body-parser";
import { DynamoDB, S3 } from "aws-sdk";
import UsersController from "./resources/user/users.controller";
import AdminController from "./resources/admin/admin.controller";
import http from "http";
import { Server } from "socket.io";

export default class App {
  public express: Application;
  public dbClient: DynamoDB;
  public s3Client: S3;
  private httpServer: http.Server;
  private io: Server;

  constructor(dbClient: DynamoDB, s3Client: S3) {
    this.express = express();
    this.dbClient = dbClient;
    this.s3Client = s3Client;
    this.httpServer = http.createServer(this.express);
    this.io = new Server(this.httpServer);
  }

  private initialiseMiddleWare(): void {
    this.express.use(cors());
    this.express.use(bodyParser.json());
    this.express.use(bodyParser.urlencoded({ extended: false }));
  }

  private async initialiseDatabaseConnection() {
    return new Promise<void>((resolve, reject) => {
      this.dbClient.listTables((err) => {
        if (err) {
          console.error("Error connecting to DynamoDB:", err);
          reject(err);
        } else {
          console.log("Connected to DynamoDB");
          resolve();
        }
      });
    });
  }

  private initialiseControllers() {
    const usersController = new UsersController(this.dbClient, this.s3Client);
    const adminController = new AdminController(this.dbClient, this.s3Client, this.io);
    this.express.use(fileUpload())
    this.express.use(`/api`, usersController.router);
    this.express.use(`/api`, adminController.router);
  }

  public async init(): Promise<void> {
    try {
      this.initialiseMiddleWare();
      this.initialiseControllers();
      await this.initialiseDatabaseConnection();
    } catch (err) {
      console.error("Failed to initialise app:", err);
      throw err;
    }
  }

  public async listen(port: number): Promise<void> {
    await this.init();
    this.httpServer.listen(port, () => {
      console.log(`App listening on port ${port}`);
    });
  }
}
