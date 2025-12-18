require("dotenv").config();
const express = require("express");
const fs = require("fs");
const crypto = require("crypto");
const axios = require("axios");
const path = require("path");
const cors = require("cors");

const app = express();

app.use(cors({
    origin: "http://localhost"
}))

app.use(express.json());


// TEST ROUTE
app.get("/", (req, res) => {
    res.send("API Digiflazz berjalan ✔");
});

async function getProdukDigiFlazz() {
    const username = process.env.DIGIFLAZZ_USERNAME;
    const apikey = process.env.DIGIFLAZZ_APIKEY;

    if (!username || !apikey) {
        throw new Error("Username / API Key Digiflazz belum di-set di .env");
    }

    const signature = crypto
        .createHash("md5")
        .update(username + apikey + "pricelist")
        .digest("hex");

    // ENDPOINT YANG BENAR
    const response = await axios.post("https://api.digiflazz.com/v1/pricelist", {
        cmd: "prepaid",
        username,
        sign: signature,
    });

    const raw = response.data;

    if (!raw || !Array.isArray(raw.data)) {
        throw new Error("Data produk tidak valid dari Digiflazz");
    }

    const updatedData = raw.data.map(item => {
        const base = item.price;

        let price_member, price_bronze, price_silver, price_gold;

        if (item.category === "Pulsa") {
            price_member = base + 1000;
            price_bronze = base + 800;
            price_silver = base + 700;
            price_gold = base + 600;
        } else if (item.category === "E-Money") {
            price_member = base + 700;
            price_bronze = base + 600;
            price_silver = base + 500;
            price_gold = base + 400;
        } else {
            price_member = Math.ceil(base * 1.06);
            price_bronze = Math.ceil(base * 1.05);
            price_silver = Math.ceil(base * 1.04);
            price_gold = Math.ceil(base * 1.03);
        }

        return {
            ...item,
            price_member,
            price_bronze,
            price_silver,
            price_gold
        };
    });

    const filePath = path.join(__dirname, "listDigiflazz.json");
    fs.writeFileSync(filePath, JSON.stringify(updatedData, null, 2));

    return {
        count: updatedData.length,
        file: filePath,
        updatedData
    };
}

// 1️⃣ UPDATE DATA
app.get("/digiflazz/update", async (req, res) => {
    try {
        const result = await getProdukDigiFlazz();
        return res.json({
            status: "success",
            message: `List produk berhasil diperbarui (${result.count} produk).`,
            file: result.file
        });
    } catch (err) {
        return res.status(500).json({
            status: "error",
            message: err.message
        });
    }
});

// 2️⃣ BACA LIST CACHE
app.get("/digiflazz/list", (req, res) => {
    const filePath = path.join(__dirname, "listDigiflazz.json");

    if (!fs.existsSync(filePath)) {
        return res.json({
            status: "error",
            message: "Data belum diupdate. Jalankan /digiflazz/update dulu"
        });
    }

    try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        return res.json({
            status: "success",
            count: data.length,
            data
        });
    } catch (err) {
        return res.status(500).json({
            status: "error",
            message: "Gagal membaca file listDigiflazz.json"
        });
    }
});

app.listen(3000, () => {
    console.log("Server Digiflazz berjalan di http://localhost:3000");
});
