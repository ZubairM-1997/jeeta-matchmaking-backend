import App from "../src/app";
import { dynamodb, s3Client } from "../src/aws";

const app = new App(dynamodb, s3Client);

app.listen(4000);
