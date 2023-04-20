import App from "./app"
import { dynamodb } from './dynamoDb'

const app = new App(dynamodb)

app.listen(4000)