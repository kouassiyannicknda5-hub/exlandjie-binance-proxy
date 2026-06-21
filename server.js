const http = require("http");
const https = require("https");
const crypto = require("crypto");

function hmacSha256Hex(secret, message) {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
}

function sendJson(res, status, obj) {
  res.writeHead(status, corsHeaders());
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, { status: "EXLANDJIE Binance proxy en ligne. Utilisez POST pour les requêtes." });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Méthode non supportée, utilisez POST." });
    return;
  }

  let body = "";
  req.on("data", chunk => { body += chunk; });
  req.on("end", () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      sendJson(res, 400, { error: "Corps de requête invalide (JSON attendu)." });
      return;
    }

    const { apiKey, apiSecret, path, params, method } = parsed;
    if (!apiKey || !apiSecret || !path) {
      sendJson(res, 400, { error: "apiKey, apiSecret et path sont obligatoires." });
      return;
    }

    try {
      const query = new URLSearchParams(params || {});
      query.set("timestamp", Date.now().toString());
      query.set("recvWindow", "10000");
      const signature = hmacSha256Hex(apiSecret, query.toString());
      query.set("signature", signature);

      const httpMethod = (method || "GET").toUpperCase();
      const options = {
        hostname: "api.binance.com",
        path: `${path}?${query.toString()}`,
        method: httpMethod,
        headers: { "X-MBX-APIKEY": apiKey },
      };

      const proxyReq = https.request(options, proxyRes => {
        let data = "";
        proxyRes.on("data", chunk => { data += chunk; });
        proxyRes.on("end", () => {
          res.writeHead(proxyRes.statusCode, corsHeaders());
          res.end(data);
        });
      });
      proxyReq.on("error", e => {
        sendJson(res, 500, { error: "Erreur du serveur relais : " + String(e) });
      });
      proxyReq.end();
    } catch (e) {
      sendJson(res, 500, { error: "Erreur du serveur relais : " + String(e) });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("EXLANDJIE Binance proxy listening on port " + PORT));
