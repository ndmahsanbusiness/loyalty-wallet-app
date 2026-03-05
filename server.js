import express from "express";
import cors from "cors";
import twilio from "twilio";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// MySQL Database Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASS || "",
    database: process.env.DB_NAME || "loyalchain_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Twilio Config
const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// --- AUTH & USER ENDPOINTS ---

app.get("/api/users", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM users");
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get("/api/user/:phone", async (req, res) => {
    try {
        const [rows] = await pool.query("SELECT * FROM users WHERE phone_number = ?", [req.params.phone]);
        if (rows.length === 0) return res.status(404).json({ error: "User not found" });
        res.json(rows[0]);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/register", async (req, res) => {
    const { full_name, phone_number, password, avatar } = req.body;
    try {
        const [result] = await pool.query(
            "INSERT INTO users (full_name, phone_number, password, total_points, role, is_active, avatar) VALUES (?, ?, ?, 10000, 'user', 1, ?)",
            [full_name, phone_number, password, avatar]
        );
        const userId = result.insertId;

        // Log welcome transaction
        await pool.query(
            "INSERT INTO transactions (receiver_id, transaction_type, points, balance_after, description) VALUES (?, 'earn', 10000, 10000, 'Welcome Credit')",
            [userId]
        );

        res.json({ success: true, userId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- TRANSACTION ENDPOINTS ---

app.get("/api/transactions/:userId", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM transactions WHERE sender_id = ? OR receiver_id = ? ORDER BY created_at DESC",
            [req.params.userId, req.params.userId]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post("/api/transfer", async (req, res) => {
    const { senderId, receiverPhone, points, description } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Get Sender
        const [senders] = await connection.query("SELECT * FROM users WHERE id = ?", [senderId]);
        const sender = senders[0];
        if (!sender || sender.total_points < points) throw new Error("Insufficient balance");

        // 2. Get Receiver
        const [receivers] = await connection.query("SELECT * FROM users WHERE phone_number = ?", [receiverPhone]);
        const receiver = receivers[0];
        if (!receiver) throw new Error("Recipient not found");
        if (receiver.id === sender.id) throw new Error("Self-transfer prohibited");

        // 3. Update Balances
        await connection.query("UPDATE users SET total_points = total_points - ? WHERE id = ?", [points, senderId]);
        await connection.query("UPDATE users SET total_points = total_points + ? WHERE id = ?", [points, receiver.id]);

        // 4. Log transactions (one for sender, one for receiver might be redundant if we use one record with sender/receiver ids)
        // Here we insert ONE record that captures both
        const [txResult] = await connection.query(
            "INSERT INTO transactions (sender_id, receiver_id, transaction_type, points, balance_after, description) VALUES (?, ?, 'transfer', ?, ?, ?)",
            [senderId, receiver.id, points, sender.total_points - points, description]
        );

        await connection.commit();
        res.json({
            success: true,
            txId: txResult.insertId,
            receiverName: receiver.full_name,
            receiverPhone: receiver.phone_number,
            newBalance: sender.total_points - points
        });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// --- SMS ENDPOINT ---

app.post("/api/admin/adjust-points", async (req, res) => {
    const { targetUserId, points, type, description } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Get Target User
        const [users] = await connection.query("SELECT * FROM users WHERE id = ?", [targetUserId]);
        const user = users[0];
        if (!user) throw new Error("User not found");

        const absPoints = Math.abs(points);
        const signedPoints = type === "add" ? absPoints : -absPoints;
        const newBalance = user.total_points + signedPoints;

        if (newBalance < 0) throw new Error("Resulting balance cannot be negative");

        // 2. Update Balance
        await connection.query("UPDATE users SET total_points = ? WHERE id = ?", [newBalance, targetUserId]);

        // 3. Log transaction
        const [txResult] = await connection.query(
            "INSERT INTO transactions (receiver_id, transaction_type, points, balance_after, description) VALUES (?, ?, ?, ?, ?)",
            [targetUserId, type === "add" ? "earn" : "redeem", signedPoints, newBalance, description]
        );

        await connection.commit();
        res.json({
            success: true,
            txId: txResult.insertId,
            newBalance: newBalance,
            phone: user.phone_number
        });
    } catch (error) {
        await connection.rollback();
        res.status(400).json({ error: error.message });
    } finally {
        connection.release();
    }
});

app.post("/api/send-sms", async (req, res) => {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: "Missing to or message" });

    try {
        const response = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: to
        });
        res.json({ success: true, sid: response.sid });
    } catch (error) {
        console.error("SMS Error:", error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`🚀 LoyalChain Backend (MySQL) running on http://localhost:${PORT}`);
});

