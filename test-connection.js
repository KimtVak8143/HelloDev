// test-connection.js
require("dotenv").config();
const { Client } = require("@notionhq/client");
const notion = new Client({ auth: process.env.NOTION_API_KEY });

(async () => {
  const res = await notion.databases.retrieve({ 
    database_id: process.env.SPRINT_DB_ID 
  });
  console.log("✅ Connected! DB:", res.title[0].plain_text);
})();