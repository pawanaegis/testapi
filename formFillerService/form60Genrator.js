const { imageFormFiller } = require("../utils/formFiller.js");

const form60Generator = async (formData) => {
  try {
    const {
      customerName,
      address,
      policyAmount,
      assessedToTax,
      supportDocType,
      supportDocNo,
      dealerState,
      signatureImg,
      reason
    } = formData;
    if (
      !customerName ||
      !address ||
      !policyAmount ||
      !supportDocType ||
      !supportDocNo ||
      !dealerState
    ) {
      const missingField = !customerName
        ? "Customer Name"
        : !address
        ? "Address"
        : !policyAmount
        ? "Policy Amount"
        : !supportDocType
        ? "Support Document Type"
        : !supportDocNo
        ? "Support Doc No"
        : "Place";
      throw new Error(`Missing required ${missingField} in formData`);
    }
    const currentDate = new Date();
    const consentDate = currentDate.getDate();
    const consentMonth = currentDate.toLocaleString("default", {
      month: "long",
    });
    const fullDate = currentDate.toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
    });
    const docNo = (supportDocType)?.toLowerCase() === 'aadhaar card' ? `********${supportDocNo?.slice(-4)}`:supportDocNo;
    const data = [
      { text: `${customerName}`, position: { x: 530, y: 360 } },
      { text: `${address}`, position: { x: 160, y: 400 } },
      { text: `${policyAmount}`, position: { x: 430, y: 526 } },
      { text: `${assessedToTax ? "Yes" : "No"}`, position: { x: 890, y: 570 } },
      { text: `${reason || ""}`, position: { x: 1010, y: 699 } },
      { text: `${supportDocType}`, position: { x: 180, y: 780 } },
      { text: `${docNo}`, position: { x: 360, y: 780 } },
      { text: `${customerName}`, position: { x: 135, y: 915 } },
      { text: `${consentDate}`, position: { x: 290, y: 985 } },
      { text: `${consentMonth}`, position: { x: 570, y: 985 } },
      { text: `${fullDate}`, position: { x: 190, y: 1025 } },
      { text: `${dealerState}`, position: { x: 190, y: 1070 } },
      { text: `${customerName}`, position: { x: 870, y: 1205 } },
    ];

    const signature = {
      image: signatureImg,
      position: { x: 870, y: 1120 },
      size: { width: 250, height: 80 },
    };

    const form60Image = "./formsImage/Form60.jpg"; // Base64-encoded image input
    return imageFormFiller(form60Image, data, signature);
  } catch (error) {
    console.error(error);
    throw new Error(error.message);
  }
};

module.exports = { form60Generator };
