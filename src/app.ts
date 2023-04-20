import express, { Application } from "express";
import cors from "cors";
import bodyParser from 'body-parser'

export interface AppConfig {
	db: DbConfig;
}

class App {
	public express: Application;
	public config: AppConfig;
	public dbClient? : Dy

}