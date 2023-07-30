import App from "./app";
import { dynamodb, s3Client } from "./aws";

const app = new App(dynamodb, s3Client);

app.listen(4000);
