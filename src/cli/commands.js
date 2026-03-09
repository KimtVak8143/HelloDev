// CLI command parser

#!/usr/bin/env node
const axios = require("axios");
const BASE = "http://localhost:3333";
const [,, action, ...args] = process.argv;

(async () => {
  if (action === "start") {
    // xyz start bug-#1 --dev "Alice"
    const bugId = args[0];
    const developer = args[args.indexOf("--dev") + 1] || "Developer";
    const { data } = await axios.post(`${BASE}/start`, { bugId, developer });
    console.log(`✅ Now tracking: ${data.bugId}`);

  } else if (action === "done") {
    // xyz done bug-#1
    const { data } = await axios.post(`${BASE}/done`, { bugId: args[0] });
    console.log(`🎉 Task marked complete!`);

  } else {
    console.log("Usage: xyz start <bug-id> --dev <name> | xyz done <bug-id>");
  }
})();