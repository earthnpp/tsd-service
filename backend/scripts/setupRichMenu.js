/**
 * Rich Menu Setup Script
 * รัน: node scripts/setupRichMenu.js
 * ต้องมีไฟล์ rich_menu.png (2500x1686px) ใน scripts/ ก่อนรัน
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const fs = require("fs");
const path = require("path");
const https = require("https");

const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

function lineAPI(method, endpoint, body, isBuffer = false) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: "api.line.me",
      path: endpoint,
      method,
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        ...(isBuffer
          ? { "Content-Type": "image/png", "Content-Length": body.length }
          : { "Content-Type": "application/json" }),
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log("🔧 Creating Rich Menu...");

  // 1. Create rich menu structure
  const richMenu = {
    size: { width: 2500, height: 1686 },
    selected: true,
    name: "IT Helpdesk Menu",
    chatBarText: "เมนู IT Helpdesk",
    areas: [
      // Top-left: FAQ
      {
        bounds: { x: 0, y: 0, width: 833, height: 843 },
        action: { type: "postback", data: "action=faq", label: "FAQ" },
      },
      // Top-center: แจ้งซ่อม
      {
        bounds: { x: 833, y: 0, width: 834, height: 843 },
        action: { type: "postback", data: "action=report", label: "แจ้งซ่อม" },
      },
      // Top-right: ดู Ticket
      {
        bounds: { x: 1667, y: 0, width: 833, height: 843 },
        action: { type: "postback", data: "action=status", label: "ดู Ticket" },
      },
      // Bottom-left: จองห้องประชุม
      {
        bounds: { x: 0, y: 843, width: 833, height: 843 },
        action: { type: "postback", data: "action=book_room", label: "จองห้องประชุม" },
      },
      // Bottom-center: รายการจอง
      {
        bounds: { x: 833, y: 843, width: 834, height: 843 },
        action: { type: "postback", data: "action=my_bookings", label: "รายการจอง" },
      },
      // Bottom-right: ติดต่อ IT
      {
        bounds: { x: 1667, y: 843, width: 833, height: 843 },
        action: { type: "postback", data: "action=contact_it", label: "ติดต่อ IT" },
      },
    ],
  };

  const created = await lineAPI("POST", "/v2/bot/richmenu", JSON.stringify(richMenu));
  if (!created.richMenuId) {
    console.error("❌ Failed to create rich menu:", created);
    process.exit(1);
  }
  const richMenuId = created.richMenuId;
  console.log("✅ Rich Menu created:", richMenuId);

  // 2. Upload image
  const imagePath = path.join(__dirname, "rich_menu.png");
  if (!fs.existsSync(imagePath)) {
    console.warn("⚠️  rich_menu.png not found — skipping image upload");
    console.warn("   วางไฟล์ rich_menu.png (2500x1686px) ใน scripts/ แล้วรันใหม่");
  } else {
    const imageBuffer = fs.readFileSync(imagePath);
    await lineAPI(
      "POST",
      `/v2/bot/richmenu/${richMenuId}/content`,
      imageBuffer,
      true
    );
    console.log("✅ Image uploaded");
  }

  // 3. Set as default rich menu
  await lineAPI("POST", `/v2/bot/user/all/richmenu/${richMenuId}`, "");
  console.log("✅ Set as default rich menu for all users");
  console.log("\n🎉 Rich Menu setup complete!");
  console.log(`   richMenuId: ${richMenuId}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
