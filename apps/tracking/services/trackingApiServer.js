/**
 * trackingApiServer.js
 * HTTP Management Server pada port 5005 untuk aksi antarmuka viewer.html (hapus session & learned categories).
 */

const http = require("http");
const { generateHtml } = require("../generate_html");
const {
  deleteSession,
  deleteLearnedCategory,
  clearAllSessions,
  clearAllLearnedCategories,
  loadLearnedCategories,
} = require("../sql/db");

const API_PORT = 5005;

function startTrackingApiServer(onLearnedCategoriesUpdated) {
  const apiServer = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === "POST") {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", async () => {
        try {
          const parsedBody = body ? JSON.parse(body) : {};

          if (req.url === "/api/delete-session") {
            if (parsedBody.id) {
              await deleteSession(parsedBody.id);
              await generateHtml();
              res.writeHead(200, { "Content-Type": "text/plain" });
              res.end("Session deleted successfully");
            } else {
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("Missing ID");
            }
          } else if (req.url === "/api/delete-learned") {
            if (parsedBody.id) {
              await deleteLearnedCategory(parsedBody.id);
              const updatedCache = await loadLearnedCategories();
              if (typeof onLearnedCategoriesUpdated === "function") {
                onLearnedCategoriesUpdated(updatedCache);
              }
              await generateHtml();
              res.writeHead(200, { "Content-Type": "text/plain" });
              res.end("Learned category deleted successfully");
            } else {
              res.writeHead(400, { "Content-Type": "text/plain" });
              res.end("Missing ID");
            }
          } else if (req.url === "/api/clear-sessions") {
            await clearAllSessions();
            await generateHtml();
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("All sessions cleared");
          } else if (req.url === "/api/clear-learned") {
            await clearAllLearnedCategories();
            if (typeof onLearnedCategoriesUpdated === "function") {
              onLearnedCategoriesUpdated({});
            }
            await generateHtml();
            res.writeHead(200, { "Content-Type": "text/plain" });
            res.end("All learned categories cleared");
          } else {
            res.writeHead(404, { "Content-Type": "text/plain" });
            res.end("Not Found");
          }
        } catch (err) {
          console.error("[Tracking API Error]:", err);
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("Internal Server Error: " + err.message);
        }
      });
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    }
  });

  apiServer.listen(API_PORT, () => {
    console.log(`[API Server] Mendengarkan perintah hapus di http://localhost:${API_PORT}`);
  });

  return apiServer;
}

module.exports = {
  startTrackingApiServer,
  API_PORT,
};
