var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_genai = require("@google/genai");
var import_dotenv = __toESM(require("dotenv"), 1);
process.env.TZ = "Asia/Aden";
import_dotenv.default.config();
var aiClient = null;
function getGeminiClient() {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      console.warn("GEMINI_API_KEY is not configured or uses placeholder. Continuing with simulated AI fallback answers.");
    }
    aiClient = new import_genai.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
var app = (0, import_express.default)();
var PORT = 3e3;
app.use(import_express.default.json());
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", serverTime: (/* @__PURE__ */ new Date()).toISOString() });
});
app.post("/api/ai/plan-generator", async (req, res) => {
  const { doctors, workplaces, visits, settings } = req.body;
  try {
    const client = getGeminiClient();
    const isMockMode = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY";
    if (isMockMode) {
      return res.json({
        plan: `### \u{1F5FA}\uFE0F \u062E\u0637\u0629 \u0633\u064A\u0631 \u0630\u0643\u064A\u0629 \u0645\u0642\u062A\u0631\u062D\u0629 (\u062E\u0648\u0627\u0631\u0632\u0645\u064A\u0629 \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A\u0627)
1. **\u0627\u0644\u0646\u0648\u0628\u0629 \u0627\u0644\u0635\u0628\u0627\u062D\u064A\u0629 - \u0645\u062C\u0645\u0639 \u0627\u0644\u0645\u0644\u0643 \u0641\u0647\u062F \u0648\u0645\u0633\u062A\u0634\u0641\u0649 \u0627\u0644\u062D\u0628\u064A\u0628 (\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0634\u0645\u0627\u0644\u064A\u0629)**:
   - \u0632\u064A\u0627\u0631\u0629 **\u062F. \u0623\u062D\u0645\u062F \u0633\u0644\u064A\u0645\u0627\u0646** (\u0627\u0644\u0641\u0626\u0629 \u0623 - \u0641\u062D\u0635 \u0627\u0644\u0642\u0644\u0628) \u0644\u062A\u0642\u0644\u064A\u0644 \u0648\u0642\u062A \u0627\u0644\u062A\u0631\u0627\u0646\u0632\u064A\u062A.
   - \u0632\u064A\u0627\u0631\u0629 **\u062F. \u062E\u0627\u0644\u062F \u0627\u0644\u062D\u0631\u0628\u064A** (\u0627\u0644\u0641\u0626\u0629 \u0628 - \u0627\u0644\u0639\u0638\u0627\u0645).
   - *\u0627\u0644\u0647\u062F\u0641*: \u062A\u063A\u0637\u064A\u0629 \u0645\u0633\u062A\u0634\u0641\u064A\u0627\u062A \u0642\u0631\u064A\u0628\u0629 \u062C\u063A\u0631\u0627\u0641\u064A\u0627\u064B \u0644\u062A\u0642\u0644\u064A\u0635 \u0645\u0633\u0627\u0641\u0627\u062A \u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644 \u0628\u0646\u0633\u0628\u0629 40%.

2. **\u0627\u0644\u0646\u0648\u0628\u0629 \u0627\u0644\u0645\u0633\u0627\u0626\u064A\u0629 - \u0645\u0633\u062A\u0634\u0641\u0649 \u062F\u0644\u0629 \u0648\u0645\u062C\u0645\u0639 \u0627\u0644\u062A\u062E\u0635\u0635\u064A (\u0627\u0644\u0645\u0646\u0637\u0642\u0629 \u0627\u0644\u0648\u0633\u0637\u0649)**:
   - \u0632\u064A\u0627\u0631\u0629 **\u062F. \u0633\u0627\u0631\u0629 \u0645\u0631\u0627\u062F** (\u0627\u0644\u0641\u0626\u0629 \u0623 - \u062C\u0644\u062F\u064A\u0629) - *\u062A\u0646\u0628\u064A\u0647 \u0625\u0647\u0645\u0627\u0644*: \u0644\u0645 \u062A\u064F\u0632\u0631 \u0645\u0646\u0630 14 \u064A\u0648\u0645\u0627\u064B!
   - \u0632\u064A\u0627\u0631\u0629 **\u062F. \u064A\u0627\u0633\u0631 \u0627\u0644\u0639\u062A\u064A\u0628\u064A** (\u0627\u0644\u0641\u0626\u0629 \u0628 - \u0623\u0637\u0641\u0627\u0644).

3. **\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u062A\u0648\u062C\u064A\u0647\u064A\u0629 \u0647\u0627\u0645\u0629**:
   - \u26A0\uFE0F **\u062A\u0646\u0628\u064A\u0647 \u0625\u0647\u0645\u0627\u0644 \u0641\u0626\u0629 \u0623**: \u0627\u0644\u0637\u0628\u064A\u0628\u0629 \u0631\u064A\u0645\u0627 \u0627\u0644\u0642\u062D\u0637\u0627\u0646\u064A \u0623\u0647\u0645\u0644\u062A \u0632\u064A\u0627\u0631\u062A\u0647\u0627 \u0644\u0623\u0643\u062B\u0631 \u0645\u0646 15 \u064A\u0648\u0645\u0627\u064B\u060C \u062A\u0645 \u0627\u0644\u062A\u0648\u0635\u064A\u0629 \u0628\u0636\u0645\u0647\u0627 \u0644\u064A\u0648\u0645 \u0627\u0644\u0623\u062D\u062F \u0646\u0648\u0628\u0629 \u0635\u0628\u0627\u062D\u064A\u0629 \u0643\u0623\u0648\u0644\u0648\u064A\u0629 \u0642\u0635\u0648\u0649.
   - \u{1F697} \u0639\u0632\u0644 \u0627\u0644\u0645\u0633\u0627\u0631\u0627\u062A: \u062A\u0645 \u062A\u062C\u0645\u064A\u0639 \u0627\u0644\u0623\u0637\u0628\u0627\u0621 \u0628\u0646\u0627\u0621\u064B \u0639\u0644\u0649 \u0646\u0633\u0628\u0629 \u0627\u0644\u062A\u0642\u0627\u0631\u0628 \u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A (Clustering) \u0644\u062E\u0641\u0636 \u0627\u0644\u062A\u0643\u0644\u0641\u0629 \u0627\u0644\u0632\u0627\u0626\u062F\u0629 \u0644\u0644\u0631\u062D\u0644\u0629 \u0648\u062A\u0641\u0627\u062F\u064A \u0627\u0644\u0627\u062E\u062A\u0646\u0627\u0642\u0627\u062A \u0627\u0644\u0645\u0631\u0648\u064A\u0629.`,
        success: true,
        source: "simulated"
      });
    }
    const payloadPrompt = `
You are an expert sales analyst and SFA planner assisting a Medical Representative with the "Med Rep" offline application.
Analyze the following representative data:
- Doctors: ${JSON.stringify(doctors)}
- Workplaces: ${JSON.stringify(workplaces)}
- Recent Visits: ${JSON.stringify(visits)}

Generate an optimized weekly plan in Arabic (fully RTL-friendly). You must adhere to the Yemen timezone constraints and apply these medical visit requirements:
- Class A requires 4 visits/month.
- Class B requires 2-3 visits/month.
- Class C requires 1 visit/month.

It must:
1. Cluster doctors by workplace proximity to minimize transit time.
2. Prioritize targets based on the class visit requirements (especially flagging any Class A neglect/under-coverage).
3. Recommend specific days/shifts (Morning or Evening) to target specific neighborhood clusters.
4. Flag deficiencies or gaps and specify if a Doctor is below their monthly frequency.

Output your plan as a clean Markdown string in beautiful Arabic language. Mention visual clusters, transit metrics, and actions clearly.
`;
    const response = await client.models.generateContent({
      model: "gemini-1.5-flash",
      contents: payloadPrompt,
      config: {
        systemInstruction: "You are an SFA (Sales Force Automation) AI routing master who speaks Arabic fluently. Address the user respectfully and operate in Yemen Time (UTC+3)."
      }
    });
    res.json({
      plan: response.text,
      success: true,
      source: "gemini"
    });
  } catch (error) {
    console.error("Gemini API Error in plan-generator:", error);
    res.status(500).json({ error: error.message || "Error executing AI planner" });
  }
});
app.post("/api/ai/doctor-analysis", async (req, res) => {
  const { doctorName, visitsSorted } = req.body;
  try {
    const client = getGeminiClient();
    const isMockMode = !process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY === "MY_GEMINI_API_KEY";
    if (isMockMode) {
      return res.json({
        analysis: `### \u{1F4C8} \u062A\u062D\u0644\u064A\u0644 \u062A\u0631\u062F\u062F \u0627\u0644\u0632\u064A\u0627\u0631\u0627\u062A \u0644\u0644\u0637\u0628\u064A\u0628: ${doctorName}
* **\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0632\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0645\u0633\u062C\u0644\u0629**: ${visitsSorted.length} \u0632\u064A\u0627\u0631\u0627\u062A.
* **\u0645\u0639\u062F\u0644 \u0627\u0644\u062A\u0628\u0627\u0639\u062F \u0627\u0644\u0632\u0645\u0646\u064A**: \u0645\u062A\u0648\u0633\u0637 12 \u064A\u0648\u0645\u0627\u064B \u0628\u064A\u0646 \u0643\u0644 \u0632\u064A\u0627\u0631\u0629\u060C \u0648\u0647\u0648 \u0645\u0627 \u064A\u0637\u0627\u0628\u0642 \u0627\u0644\u0646\u0637\u0627\u0642 \u0627\u0644\u0622\u0645\u0646 \u0644\u0632\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u0641\u0626\u0629 (\u0623).
* **\u062A\u0633\u0644\u0633\u0644 \u062A\u0648\u0632\u064A\u0639 \u0627\u0644\u0639\u064A\u0646\u0627\u062A**: \u062A\u0645 \u062A\u0641\u0631\u064A\u063A (\u0628\u0627\u0646\u062F\u0648\u0644 \u0625\u0643\u0633\u062A\u0631\u0627) \u0648(\u0623\u062A\u0648\u0631) \u0628\u0646\u062C\u0627\u062D \u0648\u0641\u0642 \u0642\u0627\u0639\u062F\u0629 FIFO \u0644\u0644\u0645\u062E\u0632\u0648\u0646 \u0627\u0644\u0623\u0642\u062F\u0645.

#### \u{1F4A1} \u062A\u0648\u0635\u064A\u0627\u062A \u0627\u0644\u0630\u0643\u0627\u0621 \u0627\u0644\u0627\u0635\u0637\u0646\u0627\u0639\u064A \u0644\u0631\u0641\u0639 \u0627\u0644\u0625\u0646\u062A\u0627\u062C\u064A\u0629:
1. **\u062B\u0628\u0627\u062A \u0627\u0644\u0645\u062A\u0627\u0628\u0639\u0629**: \u062D\u0627\u0641\u0638 \u0639\u0644\u0649 \u0648\u062A\u064A\u0631\u0629 \u0627\u0644\u0632\u064A\u0627\u0631\u0627\u062A \u0627\u0644\u062D\u0627\u0644\u064A\u0629 \u0644\u062A\u062C\u0646\u0628 \u0647\u0628\u0648\u0637 \u0627\u0644\u0641\u0626\u0629 \u0627\u0644\u0645\u0639\u064A\u0627\u0631\u064A\u0629.
2. **\u0628\u0631\u0648\u062A\u0648\u0643\u0648\u0644 \u0627\u0644\u062A\u0641\u0635\u064A\u0644 \u0627\u0644\u0637\u0628\u064A**: \u0631\u0643\u0632 \u0641\u064A \u0627\u0644\u0632\u064A\u0627\u0631\u0629 \u0627\u0644\u0642\u0627\u062F\u0645\u0629 \u0639\u0644\u0649 \u0634\u0631\u062D \u062F\u0631\u0627\u0633\u0627\u062A \u062A\u0645\u0627\u062B\u0644 \u0627\u0644\u0625\u0630\u0627\u0628\u0629 \u0627\u0644\u062D\u064A\u0648\u064A\u0629 \u0644\u0628\u0627\u0646\u062F\u0648\u0644 \u0625\u0643\u0633\u062A\u0631\u0627 \u0644\u062F\u0639\u0645 \u0627\u062A\u062E\u0627\u0630 \u0627\u0644\u0642\u0631\u0627\u0631 \u0627\u0644\u0637\u0628\u064A.
3. **\u062A\u0644\u0627\u0641\u064A \u0627\u0644\u062E\u0631\u0648\u062C \u0627\u0644\u062C\u063A\u0631\u0627\u0641\u064A**: \u062A\u0645 \u0631\u0635\u062F \u062A\u0628\u0627\u0639\u062F \u0628\u0633\u064A\u0637 \u0628\u0646\u0633\u0628\u0629 20% \u0641\u064A \u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A \u0627\u0644\u0632\u064A\u0627\u0631\u0629 \u0627\u0644\u0633\u0627\u0628\u0642\u0629\u060C \u0646\u0646\u0635\u062D \u0628\u0628\u062F\u0621 \u0646\u0638\u0627\u0645 \u0627\u0644\u062A\u062D\u0642\u0642 (Check-in) \u0645\u0628\u0627\u0634\u0631\u0629\u064B \u0641\u064A \u0639\u064A\u0627\u062F\u0629 \u0627\u0644\u0637\u0628\u064A\u0628 \u0642\u0628\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u062A\u062C\u0646\u0628 \u0625\u0646\u0630\u0627\u0631 \u0627\u0644\u0640 Geofencing.`,
        success: true,
        source: "simulated"
      });
    }
    const payloadPrompt = `
Analyze the visit history of Doctor named "${doctorName}".
Visits Data: ${JSON.stringify(visitsSorted)}

Provide a structured, insightful AI/algorithmic analysis in Arabic. Use Yemen Time (Asia/Aden) for any temporal inferences. Explain:
1. Average visit frequency.
2. Continuity pattern.
3. Compare against strict requirements: Class A requires 4 visits/month, Class B requires 2-3 visits/month, and Class C requires 1 visit/month. Detail how this doctor aligns with these targets.
4. Actionable recommendation to optimize sample distribution and maintain their class rating.

Output in beautiful Arabic formatted in clean Markdown.
`;
    const response = await client.models.generateContent({
      model: "gemini-1.5-flash",
      contents: payloadPrompt,
      config: {
        systemInstruction: "You are an SFA performance evaluation assistant operating in Yemen Time (UTC+3). Provide objective, precise feedback in Arabic."
      }
    });
    res.json({
      analysis: response.text,
      success: true,
      source: "gemini"
    });
  } catch (error) {
    console.error("Gemini API Error in doctor-analysis:", error);
    res.status(500).json({ error: error.message || "Error executing AI analysis" });
  }
});
async function startServer() {
  app.get("/sw.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.send(`
      self.addEventListener('install', (e) => {
        self.skipWaiting();
      });

      self.addEventListener('activate', (e) => {
        e.waitUntil(
          caches.keys().then((keys) => {
            return Promise.all(keys.map((key) => caches.delete(key)));
          }).then(() => self.clients.claim()).then(() => {
            return self.registration.unregister();
          })
        );
      });

      self.addEventListener('fetch', (e) => {
        // Direct pass-through to bypass any cache
        e.respondWith(fetch(e.request));
      });
    `);
  });
  app.get("/manifest.json", (req, res) => {
    res.json({
      "short_name": "MedRep",
      "name": "Med Rep SFA Pro",
      "icons": [
        {
          "src": "https://ai.google.dev/static/site-assets/images/share-ais-513315318.png",
          "type": "image/png",
          "sizes": "512x512"
        }
      ],
      "start_url": "/",
      "background_color": "#0f172a",
      "theme_color": "#4f46e5",
      "display": "standalone",
      "orientation": "portrait"
    });
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    console.log("Vite middleware loaded in DEVELOPMENT mode");
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
    console.log("Serving production static build from ./dist");
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}
startServer();
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
//# sourceMappingURL=server.cjs.map
