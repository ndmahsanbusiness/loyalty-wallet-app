import mysql from 'mysql2/promise';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

async function run() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASS || "",
        multipleStatements: true
    });

    console.log("Connected to MySQL, running setup...");
    const sql = fs.readFileSync('database_setup.sql', 'utf8');
    await connection.query(sql);
    console.log("Database initialized successfully!");
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
