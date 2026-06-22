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

function proxyToBinance(res, path, method, headers, body) {
  const options = {
    hostname: "api.binance.com",
    path: path,
    method: method,
    headers: headers,
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
  if (body) proxyReq.write(body);
  proxyReq.end();
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders());
    res.end();
    return;
  }

  if (req.method === "GET") {
    sendJson(res, 200, { status: "EXLANDJIE Binance proxy en ligne. Utilisez POST pour les requetes." });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Methode non supportee, utilisez POST." });
    return;
  }

  let body = "";
  req.on("data", chunk => { body += chunk; });
  req.on("end", () => {
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch (e) {
      sendJson(res, 400, { error: "Corps de requete invalide (JSON attendu)." });
      return;
    }

    const { apiKey, apiSecret, path, params, method, isPublic } = parsed;

    if (isPublic) {
      if (!path) { sendJson(res, 400, { error: "path obligatoire." }); return; }
      const query = new URLSearchParams(params || {});
      proxyToBinance(res, `${path}?${query.toString()}`, "GET", {});
      return;
    }

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
      proxyToBinance(res, `${path}?${query.toString()}`, httpMethod, { "X-MBX-APIKEY": apiKey });
    } catch (e) {
      sendJson(res, 500, { error: "Erreur du serveur relais : " + String(e) });
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("EXLANDJIE Binance proxy listening on port " + PORT));
