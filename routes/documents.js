const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const QRCode = require("qrcode");

// DOCX → PDF хувиргагч
const DocxToPdf = require("docx-pdf");

// Template-аас PDF үүсгэх функц
async function generateDocument(templateName, data) {
  try {
    // 1. Template файл унших
    const templatePath = path.join(__dirname, "..", "templates", templateName);
    const content = fs.readFileSync(templatePath, "binary");

    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    // 2. QR код үүсгэх
    const qrLink = `https://intaxaudit.mn/verify/${data.documentId}`;
    const qrDataUrl = await QRCode.toDataURL(qrLink);

    // 3. Placeholder-ууд руу утга хийх
    doc.setData({
      companyName: data.companyName,
      director: data.director,
      auditFee: data.auditFee,
      contractDate: data.contractDate,
      period: data.period,
      address: data.address,
      qrImage: qrDataUrl
    });

    doc.render();

    // 4. Түр файлд DOCX хадгалах
    const outputDocx = path.join(__dirname, "..", "outputs", `${data.documentId}.docx`);
    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    fs.writeFileSync(outputDocx, buffer);

    // 5. DOCX → PDF хөрвүүлэх
    const outputPdf = outputDocx.replace(".docx", ".pdf");

    await new Promise((resolve, reject) => {
      DocxToPdf(outputDocx, outputPdf, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    return outputPdf;

  } catch (err) {
    console.error("DOCUMENT GENERATION ERROR:", err);
    throw err;
  }
}

// ----------------- API ---------------------

// PDF үүсгээд клиент рүү татуулах endpoint
router.post("/generate", async (req, res) => {
  try {
    const { type, companyName } = req.body;

    const data = {
      documentId: Date.now(),
      companyName,
      director: "Д.Сайнжаргал",
      auditFee: "5,500,000₮",
      period: "2024 оны санхүүгийн жил",
      contractDate: new Date().toLocaleDateString("mn-MN"),
      address: "Улаанбаатар, БЗД, UB tower 1205",
    };

    let templateName = "";

    if (type === "contract") templateName = "contract.docx";
    if (type === "engagement") templateName = "engagement_letter.docx";
    if (type === "management") templateName = "management_letter.docx";

    const pdfPath = await generateDocument(templateName, data);

    res.download(pdfPath);

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "PDF үүсгэхэд алдаа гарлаа" });
  }
});

module.exports = router;
