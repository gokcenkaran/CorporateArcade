/**
 * MCP Server v2.0.0 Full Test Script
 *
 * Bu script:
 * 1. MCP Server'a bağlanır
 * 2. Session init ile app listesini alır
 * 3. App endpoint'ine istek atar
 * 4. App'tan dönen response'u işler
 *
 * Çalıştır: node test-mcp.js
 */

import crypto from "crypto";
import http from "http";

// ============ KONFİGÜRASYON ============
const MCP_SERVER_URL = "https://aimcp.replit.app";
const CUSTOMER_ID = "93ac9c2e-df22-437b-a9dc-0ffa666b3e65";
const PROJECT_ID = "f52ccba8-03ea-4a9c-9d7c-e02bd6436c30";
const MCP_API_SECRET = "k5TuCjTsADoGYnIVXbtIYTArcrympXGP";
const USER_ID = "test-user-001";

// Test için arcade URL
const ARCADE_URL = "https://testarcade.replit.app";
// =======================================

function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function createJWT() {
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    customerId: CUSTOMER_ID,
    projectId: PROJECT_ID,
    userId: USER_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));

  const signature = crypto
    .createHmac("sha256", MCP_API_SECRET)
    .update(`${headerB64}.${payloadB64}`)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${headerB64}.${payloadB64}.${signature}`;
}

/**
 * 1. Session Init - MCP Server'dan app listesini al
 */
async function sessionInit() {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 1: Session Init");
  console.log("=".repeat(60));

  const token = createJWT();
  console.log("\nJWT Token (ilk 50 karakter):", token.substring(0, 50) + "...");

  const url = `${MCP_SERVER_URL}/mcp/v1/session/init?language=tr`;
  console.log("Request URL:", url);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("\nResponse Status:", response.status, response.statusText);
    const data = await response.json();

    if (data.status === "success") {
      console.log("\n✅ Session Init BAŞARILI!");
      console.log("   Session ID:", data.session?.id);
      console.log("   Session Expires:", data.session?.expires_at);
      console.log("   Apps:", data.apps?.length || 0);

      if (data.apps?.length > 0) {
        console.log("\n   📱 Yüklü Uygulamalar:");
        data.apps.forEach((app, i) => {
          console.log(`\n   ${i + 1}. ${app.name} (${app.id})`);
          console.log(`      Endpoint: ${app.endpoint}`);
          console.log(`      Response Type: ${app.response_type}`);
          console.log(`      Token Expires: ${app.token_expires_at}`);
          if (app.keywords?.intent) {
            console.log(`      Intent: ${app.keywords.intent}`);
          }
        });
      }
      return data;
    } else {
      console.log("\n❌ Session Init BAŞARISIZ");
      console.log("   Error:", data.error?.message || JSON.stringify(data));
      return null;
    }
  } catch (error) {
    console.log("\n❌ Request Hatası:", error.message);
    return null;
  }
}

/**
 * 2. App'ı çağır - Endpoint'e token ile istek at
 */
async function callApp(app, params = {}) {
  console.log("\n" + "=".repeat(60));
  console.log(`STEP 2: Call App - ${app.name}`);
  console.log("=".repeat(60));

  console.log("\n📡 App Detayları:");
  console.log("   ID:", app.id);
  console.log("   Endpoint:", app.endpoint);
  console.log("   Response Type:", app.response_type);

  // App endpoint'ine istek at
  const callUrl = `${app.endpoint}`;
  console.log("\n🚀 Calling:", callUrl);

  try {
    // App'a gönderilecek context
    const context = {
      resourceId: `test-resource-${Date.now()}`,
      userId: USER_ID,
      customerId: CUSTOMER_ID,
      projectId: PROJECT_ID,
      token: app.token,
      config: params
    };

    console.log("\n📤 Context gönderiliyor:");
    console.log(JSON.stringify(context, null, 2));

    // Response type'a göre işlem
    if (app.response_type === "layer") {
      console.log("\n📺 Response Type: LAYER");
      console.log("   Bu app layer modunda açılacak.");
      console.log("   Endpoint URL'i iframe/layer olarak yüklenecek.");

      // Layer mode için launch URL oluştur
      const launchUrl = new URL(app.endpoint);
      launchUrl.searchParams.set("token", app.token);
      launchUrl.searchParams.set("resourceId", context.resourceId);
      launchUrl.searchParams.set("userId", context.userId);

      console.log("\n🔗 Launch URL:");
      console.log("   " + launchUrl.toString());

      return {
        type: "layer",
        launchUrl: launchUrl.toString(),
        app: app,
        context: context
      };

    } else if (app.response_type === "inline") {
      console.log("\n📝 Response Type: INLINE");
      console.log("   Bu app inline response dönecek.");

      // Inline mode için API call
      const response = await fetch(app.endpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${app.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(context)
      });

      const data = await response.json();
      console.log("\n📥 Inline Response:");
      console.log(JSON.stringify(data, null, 2));

      return {
        type: "inline",
        data: data,
        app: app
      };
    }

  } catch (error) {
    console.log("\n❌ App Call Hatası:", error.message);
    return null;
  }
}

/**
 * 3. Layer modunda app'tan gelen mesajları simüle et
 */
function simulateLayerCommunication(launchUrl) {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 3: Layer Communication Simulation");
  console.log("=".repeat(60));

  console.log("\n📡 Gerçek bir browser ortamında:");
  console.log("   1. launchUrl iframe/layer içinde açılır");
  console.log("   2. App 'mcp:ready' mesajı gönderir");
  console.log("   3. Caller 'mcp:init' ile context gönderir");
  console.log("   4. App çalışır ve 'mcp:progress' mesajları gönderir");
  console.log("   5. App kapanırken 'mcp:complete' veya 'mcp:cancel' gönderir");

  console.log("\n📋 Beklenen MCP Mesajları:");

  // Ready mesajı
  const readyMsg = {
    type: "mcp:ready",
    appId: "corporate-arcade",
    version: "1.0.0",
    capabilities: ["progress", "complete", "cancel"]
  };
  console.log("\n   → mcp:ready");
  console.log("     " + JSON.stringify(readyMsg));

  // Progress mesajı örneği
  const progressMsg = {
    type: "mcp:progress",
    appId: "corporate-arcade",
    progressType: "game",
    data: {
      score: 150,
      level: 2,
      lives: 2,
      timeElapsed: 45
    }
  };
  console.log("\n   → mcp:progress");
  console.log("     " + JSON.stringify(progressMsg));

  // Complete mesajı örneği
  const completeMsg = {
    type: "mcp:complete",
    appId: "corporate-arcade",
    status: "completed",
    data: {
      type: "game",
      finalScore: 500,
      highScore: 500,
      level: 5,
      timeElapsed: 180,
      won: true
    }
  };
  console.log("\n   → mcp:complete");
  console.log("     " + JSON.stringify(completeMsg));

  return { readyMsg, progressMsg, completeMsg };
}

/**
 * 4. Token Refresh testi
 */
async function testTokenRefresh(appId) {
  console.log("\n" + "=".repeat(60));
  console.log("STEP 4: Token Refresh");
  console.log("=".repeat(60));

  const token = createJWT();
  const url = `${MCP_SERVER_URL}/mcp/v1/token/refresh`;

  console.log("\nRequest URL:", url);
  console.log("App ID:", appId);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ app_id: appId })
    });

    console.log("\nResponse Status:", response.status, response.statusText);
    const data = await response.json();

    if (data.status === "success") {
      console.log("\n✅ Token Refresh BAŞARILI!");
      console.log("   New Token (ilk 50):", data.token?.substring(0, 50) + "...");
      console.log("   Expires At:", data.expires_at);
      return data;
    } else {
      console.log("\n❌ Token Refresh BAŞARISIZ");
      console.log("   Error:", data.error?.message || JSON.stringify(data));
      return null;
    }
  } catch (error) {
    console.log("\n❌ Request Hatası:", error.message);
    return null;
  }
}

/**
 * 5. Local test server - Layer response'larını almak için
 */
function startLocalTestServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        console.log("\n" + "=".repeat(60));
        console.log("📥 LOCAL SERVER - Incoming Request");
        console.log("=".repeat(60));
        console.log("Method:", req.method);
        console.log("URL:", req.url);
        console.log("Headers:", JSON.stringify(req.headers, null, 2));
        if (body) {
          console.log("Body:", body);
        }

        // CORS headers
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

        if (req.method === "OPTIONS") {
          res.writeHead(204);
          res.end();
          return;
        }

        // Mock response
        const response = {
          status: "success",
          message: "Test server received your request",
          received: {
            method: req.method,
            url: req.url,
            body: body ? JSON.parse(body) : null
          }
        };

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(response, null, 2));
      });
    });

    server.listen(LOCAL_SERVER_PORT, () => {
      console.log(`\n🖥️  Local test server running at http://localhost:${LOCAL_SERVER_PORT}`);
      resolve(server);
    });
  });
}

/**
 * Ana test fonksiyonu
 */
async function main() {
  console.log("\n");
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║       MCP SERVER v2.0.0 FULL INTEGRATION TEST            ║");
  console.log("╚══════════════════════════════════════════════════════════╝");

  // Step 1: Session Init
  const sessionData = await sessionInit();

  if (!sessionData || !sessionData.apps?.length) {
    console.log("\n⚠️  No apps found. Test cannot continue.");
    console.log("    Make sure apps are assigned to your project.");
    return;
  }

  // Step 2: İlk app'ı çağır
  const firstApp = sessionData.apps[0];
  const callResult = await callApp(firstApp, { theme: "dark" });

  if (callResult?.type === "layer") {
    // Step 3: Layer communication simulation
    simulateLayerCommunication(callResult.launchUrl);
  }

  // Step 4: Token refresh test
  await testTokenRefresh(firstApp.id);

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  console.log("\n✅ Session Init: PASSED");
  console.log("   - Session ID:", sessionData.session?.id);
  console.log("   - Apps Found:", sessionData.apps?.length);

  if (callResult) {
    console.log("\n✅ App Call: PASSED");
    console.log("   - App:", firstApp.name);
    console.log("   - Response Type:", callResult.type);
    if (callResult.launchUrl) {
      console.log("   - Launch URL: Generated");
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("🎉 ALL TESTS COMPLETED");
  console.log("=".repeat(60));

  console.log("\n📝 Sonraki Adımlar:");
  console.log("   1. Browser'da test-caller.html sayfasını aç");
  console.log("   2. Arcade oyununu oyna");
  console.log("   3. MCP mesajlarının doğru geldiğini kontrol et");
  console.log("   4. Oyun bittiğinde complete mesajını kontrol et\n");
}

// Run
main().catch(console.error);
