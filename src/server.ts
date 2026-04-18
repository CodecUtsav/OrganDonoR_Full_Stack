import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB
mongoose
  .connect(process.env.MONGO_URI || "")
  .then(() => console.log("Connected to MongoDB successfully"))
  .catch((err) => console.error("MongoDB connection error:", err));

app.use(
  cors({
    origin: process.env.ORIGIN?.split(","),
    credentials: true,
  }),
);
app.use(express.json());

// API Routes
app.get("/api/telegram/status", async (req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return res.status(200).json({ configured: false });
  }

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`,
    );
    const data = await response.json();
    if (data.ok) {
      res.json({ configured: true, bot: data.result });
    } else {
      res.json({ configured: true, error: data.description });
    }
  } catch (error) {
    res
      .status(500)
      .json({ configured: true, error: "Failed to connect to Telegram" });
  }
});

app.post("/api/telegram/notify", async (req, res) => {
  const { chatId, message } = req.body;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!botToken) {
    console.warn("TELEGRAM_BOT_TOKEN is not configured.");
    return res.status(500).json({ error: "Telegram Bot Token not configured" });
  }

  try {
    const targetChatId = chatId || process.env.TELEGRAM_SYSTEM_CHAT_ID;
    if (!targetChatId) {
      return res
        .status(400)
        .json({ error: "No target Chat ID provided or configured" });
    }

    console.log(`Sending Telegram notification to ${targetChatId}...`);

    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: message,
          parse_mode: "Markdown",
        }),
      },
    );

    const data = await response.json();
    if (!data.ok) {
      // Provide more descriptive errors for common Telegram issues
      let errorMessage = data.description || "Telegram API error";
      if (data.description === "Bad Request: chat not found") {
        errorMessage =
          "Chat ID not found. Ensure you have started a conversation with the bot or the ID is correct.";
      } else if (
        data.description === "Forbidden: bot was blocked by the user"
      ) {
        errorMessage =
          "The bot was blocked by the user. Please unblock the bot to receive notifications.";
      }

      console.error(
        `Telegram Error for Chat ${targetChatId}:`,
        data.description,
      );
      return res
        .status(400)
        .json({ error: errorMessage, telegramDescription: data.description });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Telegram notification exception:", error);
    res
      .status(500)
      .json({
        error: "Failed to send Telegram notification due to a server error.",
      });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://0.0.0.0:${PORT}`);
});
