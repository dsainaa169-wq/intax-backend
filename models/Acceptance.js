// backend/models/Acceptance.js

const mongoose = require("mongoose");

const acceptanceSchema = new mongoose.Schema(
  {
    // "new" / "old"
    clientType: { type: String, required: true },

    // Компанийн нэр
    companyName: { type: String, required: true },

    // Холбогдох хүний мэдээлэл (дараа нь form дээр нэмнэ)
    contactName: String,
    contactEmail: String,
    contactPhone: String,

    // Асуулгын төрөл (шинэ / хуучин харилцагчийн тусдаа асуулга)
    questionnaireType: String, // "newClient" / "oldClient" гэх мэт

    // Асуулгын дэлгэрэнгүй хариултуудыг JSON хэлбэрээр хадгална
    answers: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true, // createdAt, updatedAt автоматаар нэмэгдэнэ
  }
);

// Давхар model үүсгэхээс сэргийлэх
const Acceptance =
  mongoose.models.Acceptance ||
  mongoose.model("Acceptance", acceptanceSchema);

module.exports = Acceptance;
