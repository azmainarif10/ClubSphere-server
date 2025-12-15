const fs = require("fs");
const key = fs.readFileSync("./clubsphere-61f0c-firebase-adminsdk.json.json", "utf8");
const base64 = Buffer.from(key).toString("base64");
console.log(base64);