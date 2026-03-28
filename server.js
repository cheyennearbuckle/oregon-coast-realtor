const express = require("express");
const path = require("path");
const app = express();

// Parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
app.use(express.static("."));

// Lead capture endpoint — all leads route to Cheyenne@pacificpropertiesteam.com
const LEAD_EMAIL = "Cheyenne@pacificpropertiesteam.com";

app.post("/api/lead", (req, res) => {
  const { name, email, phone, message, type, address, subject, _to } = req.body;
  const lead = { name, email, phone, type: type || subject, message, address, sentTo: _to || LEAD_EMAIL, timestamp: new Date().toISOString() };
  console.log("\n===== NEW LEAD =====");
  console.log(JSON.stringify(lead, null, 2));
  console.log("===================\n");
  // TODO (production): Connect to email service (SendGrid, Mailgun, etc.) to forward to LEAD_EMAIL
  // TODO (production): Connect to CRM (Follow Up Boss, kvCORE, etc.)
  res.json({ success: true, message: "Thank you! Cheyenne will be in touch within one business day." });
});

// Newsletter signup
app.post("/api/newsletter", (req, res) => {
  const { email, _to } = req.body;
  console.log("\n===== NEWSLETTER SIGNUP =====");
  console.log("Email:", email, "| Route to:", _to || LEAD_EMAIL);
  console.log("=============================\n");
  // TODO (production): Connect to email marketing service (Mailchimp, ConvertKit, etc.)
  res.json({ success: true, message: "You're on the list! Watch your inbox for Oregon Coast market updates." });
});

// SPA fallback — serve index.html for any unmatched route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(5000, "0.0.0.0", () => console.log("Cheyenne Sells Oregon — listening on port 5000"));
