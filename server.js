const express = require("express");
const path = require("path");
const app = express();

// Parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Serve static files
app.use(express.static("."));

// Lead capture endpoint
app.post("/api/lead", (req, res) => {
  const { name, email, phone, message, type } = req.body;
  console.log("New lead:", { name, email, phone, type, message });
  // In production, connect to a CRM or email service
  res.json({ success: true, message: "Thank you! Cheyenne will be in touch soon." });
});

// Newsletter signup
app.post("/api/newsletter", (req, res) => {
  const { email } = req.body;
  console.log("Newsletter signup:", email);
  res.json({ success: true, message: "You're on the list!" });
});

// SPA fallback — serve index.html for any unmatched route
app.use((req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(5000, "0.0.0.0", () => console.log("Cheyenne Sells Oregon — listening on port 5000"));
