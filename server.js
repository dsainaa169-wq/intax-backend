// backend/server.js

const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const PDFDocument = require("pdfkit");

// ================== ENV ================
dotenv.config();

const app = express();

// ================== MIDDLEWARE ==================
app.use(express.json());
app.use(
  cors({
    origin: "*",
  })
);

// ================== MONGODB CONNECT ==================
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("❌ MONGODB_URI тохиргоо .env файлд алга байна.");
  process.exit(1);
}

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("✅ MongoDB холбогдлоо");
  })
  .catch((err) => {
    console.error("❌ MongoDB алдаа:", err);
  });

// ================== ACCEPTANCE SCHEMA & MODEL ==================
const acceptanceSchema = new mongoose.Schema(
  {
    clientType: { type: String, required: true }, // "new" / "old"
    companyName: { type: String, required: true },

    revenue: String,
    totalAssets: String,
  },
  { timestamps: true }
);

// virtual id (frontend-д хэрэгтэй)
acceptanceSchema.virtual("id").get(function () {
  return this._id.toString();
});
acceptanceSchema.set("toJSON", { virtuals: true });

const Acceptance =
  mongoose.models.Acceptance ||
  mongoose.model("Acceptance", acceptanceSchema);

// ================== ROUTES ==================

// Root test
app.get("/", (req, res) => {
  res.send(
    "INTAX Audit Backend ажиллаж байна. /acceptance GET/POST бэлэн, /documents/generate PDF бэлэн."
  );
});

// POST /acceptance — харилцагчийн асуулга хадгалах
app.post("/acceptance", async (req, res) => {
  try {
    const { clientType, companyName, revenue, totalAssets } = req.body;

    if (!clientType || !companyName) {
      return res.status(400).json({
        success: false,
        message: "clientType болон companyName заавал бөглөнө.",
      });
    }

    const record = await Acceptance.create({
      clientType,
      companyName,
      revenue,
      totalAssets,
    });

    console.log("NEW ACCEPTANCE:", record._id, clientType, companyName);

    res.json({
      success: true,
      message: "Мэдээлэл амжилттай хадгалагдлаа!",
      id: record._id.toString(),
      record: record.toJSON(),
    });
  } catch (err) {
    console.error("ACCEPTANCE SAVE ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Серверийн алдаа гарлаа.",
    });
  }
});

// GET /acceptance — аудиторын самбарын жагсаалт
app.get("/acceptance", async (req, res) => {
  try {
    const list = await Acceptance.find().sort({ createdAt: -1 }).lean();

    const data = list.map((doc) => ({
      id: doc._id.toString(),
      clientType: doc.clientType,
      companyName: doc.companyName,
      revenue: doc.revenue || "",
      totalAssets: doc.totalAssets || "",
      createdAt: doc.createdAt,
    }));

    res.json({
      success: true,
      count: data.length,
      data,
    });
  } catch (err) {
    console.error("ACCEPTANCE LIST ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Серверийн алдаа гарлаа.",
    });
  }
});

// ================== PDF БАРИМТ ҮҮСГЭХ ================
// POST /documents/generate
// body: { type: "contract" | "engagement" | "management", companyName: "..." }

app.post("/documents/generate", async (req, res) => {
  try {
    const { type, companyName } = req.body;

    if (!type || !companyName) {
      return res.status(400).json({
        success: false,
        message: "type болон companyName шаардлагатай.",
      });
    }

    // Header – PDF гэж мэдэгдэнэ
    res.setHeader("Content-Type", "application/pdf");

    const filenameBase =
      type === "contract"
        ? "Audit_Contract"
        : type === "engagement"
        ? "Engagement_Letter"
        : "Management_Letter";

    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${filenameBase}_${encodeURIComponent(
        companyName
      )}.pdf`
    );

    const doc = new PDFDocument({ margin: 72 }); // 1 inch margin
    doc.pipe(res);

    // --------- Дээд хэсэг: INTAX header ---------
    doc
      .fillColor("#0b2559")
      .fontSize(18)
      .text("INTAX АУДИТЫН ҮЙЛЧИЛГЭЭ", { align: "right" });

    doc.moveDown(0.3);

    doc.fontSize(11).fillColor("#444").text("“Итгэлцлийг бүтээнэ.”", {
      align: "right",
    });

    doc.moveDown(1);

    // --------- Баримтын гарчиг ---------
    let title = "";
    if (type === "contract") {
      title = "АУДИТЫН ҮЙЛЧИЛГЭЭ ҮЗҮҮЛЭХ ГЭРЭЭ";
    } else if (type === "engagement") {
      title = "АУДИТЫН ГЭРЭЭТ АЖЛЫН ЗАХИДАЛ";
    } else {
      title = "УДИРДЛАГЫН ХАРИУЦЛАГЫН ЗАХИДАЛ";
    }

    doc.fontSize(16).fillColor("#000").text(title, {
      align: "center",
      underline: true,
    });

    doc.moveDown(1.5);

    const today = new Date();
    const dateStr = today.toISOString().substring(0, 10); // YYYY-MM-DD

    // --------- Үндсэн мэдээлэл ---------
    doc.fontSize(11).fillColor("#000");
    doc.text(`Компанийн нэр: ${companyName}`);
    doc.text(`Огноо: ${dateStr}`);
    doc.text(
      "Хаяг: Баянзүрх дүүрэг, 43-р хороо, UB tower, 12 давхар, 1205 тоот"
    );
    doc.text("Имэйл: intaxaudit.mail.mn");
    doc.text("Утас: 9908-0493");

    doc.moveDown(1.2);

    // --------- Гарын үсгийн өмнөх үндсэн агуулга ---------
    if (type === "contract") {
      doc.text(
        "Энэхүү гэрээ нь INTAX АУДИТ (цаашид 'Аудитор' гэх) болон дээр дурдсан үйлчлүүлэгч байгууллага (цаашид 'Харилцагч' гэх)-ийн хооронд санхүүгийн тайлангийн аудитын үйлчилгээ үзүүлэхтэй холбогдон байгуулагдана.",
        { align: "justify" }
      );
      doc.moveDown(0.8);
      doc.text(
        "Аудит нь олон улсын аудитын стандарт (АОУС)-ыг мөрдөн гүйцэтгэгдэж, санхүүгийн тайлан бодитой, үнэн зөв байдлаар илэрхийлэгдсэн эсэхэд мэргэжлийн дүгнэлт гаргана.",
        { align: "justify" }
      );
    } else if (type === "engagement") {
      doc.text(
        "Энэхүү захидлын зорилго нь аудиторын ажлын зорилго, цар хүрээ болон харилцагчийн удирдлагын үүрэг хариуцлагыг тодорхой болгоход оршино.",
        { align: "justify" }
      );
      doc.moveDown(0.8);
      doc.text(
        "Аудит нь АОУС-ийн шаардлагын дагуу төлөвлөгдөж, гүйцэтгэгдэж, санхүүгийн тайлан материаллаг алдаагүй байхаар хангалттай баталгаажуулалт өгөх түвшинд нотолгоо цуглуулна.",
        { align: "justify" }
      );
    } else {
      doc.text(
        "Энэхүү захидлаар бид санхүүгийн тайлангийн бэлтгэл, мэдээлэл өгөх, нягтлан бодох бүртгэлийн бодлого сонгох, мөрдөхтэй холбоотой таны удирдлагын хариуцлагыг дахин баталгаажуулж байна.",
        { align: "justify" }
      );
      doc.moveDown(0.8);
      doc.text(
        "Аудиторын үүрэг нь санхүүгийн тайлан дээр хараат бус мэргэжлийн дүгнэлт гаргах бөгөөд санхүүгийн мэдээлэл, нотлох баримтыг бүрэн, үнэн зөвөөр гаргаж өгөх нь таны удирдлагын үндсэн хариуцлага хэвээр байна.",
        { align: "justify" }
      );
    }

    doc.moveDown(2);

    // --------- Гарын үсгийн блок ---------
    doc.text("Хүндэтгэсэн,", { align: "left" });
    doc.moveDown(0.5);
    doc.text("INTAX АУДИТЫН ҮЙЛЧИЛГЭЭ", { align: "left" });
    doc.text("Гүйцэтгэх захирал: Д. Сайнжаргал", { align: "left" });

    doc.moveDown(1.5);

    // --------- Доод хэсгийн тайлбар + баталгаажуулалт ---------
    doc.fontSize(9).fillColor("#6b7280");
    doc.text(
      "Энэхүү PDF нь INTAX Audit Portal системээс автоматаар үүсэв.",
      { align: "left" }
    );
    doc.text("Баталгаажуулалт: https://intaxaudit.mn/verify/[documentID]", {
      align: "left",
    });

    doc.end();
  } catch (err) {
    console.error("DOCUMENT GENERATION ERROR:", err);
    res.status(500).json({
      success: false,
      message: "PDF үүсгэхэд серверийн алдаа гарлаа.",
    });
  }
});

// ================== START SERVER ==================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("🚀 SERVER WORKING ON PORT:", PORT);
});
