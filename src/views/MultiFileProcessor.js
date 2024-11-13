import React, { useState } from "react";
import axios from "axios";
import * as pdfjsLib from "pdfjs-dist";
import {
  Spin,
  Card,
  Button,
  Typography,
  Descriptions,
  message,
  Divider,
  Alert,
  Upload,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import "pdfjs-dist/build/pdf.worker.entry";
import "../assets/css/MultiFileProcessor.css";

const COHERE_API_KEY = "isNPQuOHFfylkkIHoThFtvQVTt79ZnQv4AwXOl2E";
const GOOGLE_VISION_API_KEY = "AIzaSyBQpg9s-125r-xeyOG5N3dqNDY9mdkLIQw";
const { Title, Paragraph } = Typography;

const MultiFileProcessor = () => {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [ocrResults, setOcrResults] = useState([]);
  const [aiResponse, setAiResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const handleFileChange = ({ fileList }) => {
    setSelectedFiles(fileList.map((file) => file.originFileObj));
    setOcrResults([]);
    setAiResponse("");
  };

  const handleFileUpload = async () => {
    if (selectedFiles.length === 0) {
      message.error("Please select PDF files.");
      return;
    }

    setLoading(true);
    const results = [];

    for (const file of selectedFiles) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const pdfData = new Uint8Array(reader.result);
        const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
        let fileText = "";

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({ canvasContext: context, viewport }).promise;

          const imageBase64 = canvas
            .toDataURL("image/png")
            .replace(/^data:image\/png;base64,/, "");

          try {
            const response = await axios.post(
              `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
              {
                requests: [
                  {
                    image: { content: imageBase64 },
                    features: [{ type: "TEXT_DETECTION" }],
                  },
                ],
              }
            );

            const textAnnotations = response.data.responses[0].textAnnotations;
            fileText += `\n--- Page ${i} ---\n${
              textAnnotations ? textAnnotations[0].description : "No text found"
            }\n`;
          } catch (error) {
            console.error(
              `Error processing page ${i} of file ${file.name}:`,
              error
            );
            fileText += `\n--- Page ${i} ---\nError processing page.\n`;
          }
        }

        results.push({ fileName: file.name, text: fileText });
        setOcrResults([...results]);

        if (results.length === selectedFiles.length) {
          setLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleAskAI = async () => {
    if (ocrResults.length === 0) {
      message.error("Please perform OCR on the files first.");
      return;
    }

    setAiLoading(true);
    const combinedText = ocrResults
      .map(
        (result, index) =>
          `File ${index + 1}: ${result.fileName}\n${result.text}`
      )
      .join("\n\n");

    try {
      const response = await axios.post(
        "https://api.cohere.ai/v1/generate",
        {
          model: "command-xlarge-nightly",
          prompt: `Extract only the following information accurately and in the specified format. Do not include any prefixes, numbering, or extra words. Output only the values as shown in each example below:\n\n
        1. Bill of Lading No.: (example: (HCMBKK029112022), (HCMBKK031112022),(HCMBKK030112022))\n
        2. Consignor/Shipper: (example: (PANALPINA WORLD TRANSPORT (VIETNAM) CO., LTD. AS AGENT FOR AND ON BEHALF OF PANTAINER LTD.,#3/F HAI AU BUILDING 39B TRUONG SON ST, TAN BINH, HCMC, VIETNAM),(VIET HOA TRANSPORT SERVICE AND TRADING CO., LTD#284 NGUYEN TAT THANH STR, WARD 13, DIST 4, HCMC, VIETNAM),(MAC - NELS SHIPPING VIETNAM CO., LTD#29 PHO DOC CHINH STR., DIST 1 HOCHIMINH CITY, VIETNAM))\n
        3. Consigned to Order of: (example: (PANALPINA WORLD TRANSPORT (VIETNAM) AS AGENT FOR AND ON BEHALF OF PANTAINER LTD.,#SIRINRAT BUILDING, 14TH FLOOR 3388/47-49 NAMA IV ROAD KLONGTON, KLONGTOEY BANGKOK 10110),( SUGATTI FREIGHT INT'L (THAILAND) CO., LTD # 11/38 SUKHUMVIT ROAD FRAXANONG, KLONGTOEY),(TO THE ORDER OF THE HOLDER SURRENDERED BBL NO. 1/DKK 290439 TO BE ISSUED BY MAC - NELS CONTAINER LINES))\n
        4. Notify party: (example: nếu như gặp trường hợp có chữ "SAME AS ABOVE" thì sẽ lấy giống 100% của dữ liệu phần Consigned to Order of,(PRO - LOG CO., LTD#191/14 CTL TOWEL, 28TH FLOOR, RATCHADAPISE RD., KLONGTOEY BANGKOK 10110 THAILAND), )\n
        5. Port of Loading; (example: (HOCHIMINH))\n
        6. Port of Discharge: (example: (BANGKOK))\n
        7. Place of Delivery: (example: (BANGKOK CFS))\n
        8. Number and Kind of Packages, Description of Goods: (example: (CTNS và MAIN MATERIAL ACCESSIORIES FOR MARKING LADIES' UNDERWEAR),(CTNS và FABRIC 100 PCT. POLYESTER W: 114 CM),(CTNS và WAVEN FABRIC PATTERN NO. MD39 100 PCT POLY ESTER WIDTH: 58'))\n
        9. CONTAINER & SEAL NO: (example: (CSLU2082865 và 21567932))\n
        10. Gross Weight: (example: (9.00),(1,899.58),(64.64))\n
        11. CBM/ Volume: (example: (1.000),(1.000),(6.000))\n
        12. Place and Date of Issue: (example: (01 DEC, 2022))\n\n


Danh Sách Mã Loại Kiện\n
                    Mã kiện (thông tin này thể hiện trong form Bill of Lading) | Mã kiện 2 ký tự (thông tin này thể hiện trong file excel Manifest) | Tên loại kiện\n
                    CTN | CT | Carton\n
                    PAL | PL | Pallet\n
                    ROL | RL | Roll\n
                    PKG | PK | Package\n
                    (add additional data as required)\n\n

                    Danh Sách Mã Cảng\n
                    STT | Tên cảng (thông tin này nằm trong HBL) | Mã cảng (thông tin này thể hiện trong file Excel Manifest)\n
                    1 | YOKOHAMA | JPYOK\n
                    2 | HO CHI MINH | VNCLI\n
                    3 | CAT LAI | VNCLI\n
                    4 | CAI MEP | VNCMT\n
                    5 | BANGKOK | THBKK\n
                    (add additional data as required)\n\n


        Only extract the exact information following each label in the data below. Avoid any introductory words or extra formatting.\n\nData:\n\n${combinedText}`,
          max_tokens: 1000,
          temperature: 0,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${COHERE_API_KEY}`,
          },
        }
      );
      if (response.data && response.data.generations) {
        setAiResponse(response.data.generations[0].text.trim());
      } else {
        throw new Error("No response from AI.");
      }
    } catch (error) {
      message.error("Error from AI API");
    } finally {
      setAiLoading(false);
    }
  };

  const renderAIResponse = () => {
    const responseLines = aiResponse.split("\n").map((line) => line.trim());
    const dataFields = [
      { label: "Bill of Lading No.", value: responseLines[0] || "Not found" },
      { label: "Consignor/Shipper", value: responseLines[1] || "Not found" },
      {
        label: "Consigned to Order of",
        value: responseLines[2] || "Not found",
      },
      { label: "Notify Party", value: responseLines[3] || "Not found" },
      { label: "Port of Loading", value: responseLines[4] || "Not found" },
      { label: "Port of Discharge", value: responseLines[5] || "Not found" },
      { label: "Place of Delivery", value: responseLines[6] || "Not found" },
      {
        label: "Number and Kind of Packages, Description of Goods",
        value: responseLines[7] || "Not found",
      },
      { label: "CONTAINER & SEAL NO", value: responseLines[8] || "Not found" },
      { label: "Gross Weight", value: responseLines[9] || "Not found" },
      { label: "CBM/Volume", value: responseLines[10] || "Not found" },
      {
        label: "Place and Date of Issue",
        value: responseLines[11] || "Not found",
      },
    ];

    return (
      <Descriptions title="AI Extracted Information" bordered column={1}>
        {dataFields.map((field, index) => (
          <Descriptions.Item label={field.label} key={index}>
            <Paragraph>{field.value}</Paragraph>
          </Descriptions.Item>
        ))}
      </Descriptions>
    );
  };

  return (
    <div className="multi-file-processor">
      <Card
        title="Multi PDF Upload and AI Data Processor"
        bordered={false}
        className="main-card"
      >
        <Title level={4} className="title">
          Upload and Analyze Multiple PDFs
        </Title>

        <Upload
          multiple
          accept=".pdf"
          onChange={handleFileChange}
          fileList={selectedFiles.map((file) => ({
            uid: file.uid,
            name: file.name,
            status: "done",
          }))}
          beforeUpload={() => false} // Prevent auto upload
          className="upload-section"
        >
          <Button icon={<UploadOutlined />}>Select PDF Files</Button>
        </Upload>

        <Divider />

        <Button
          type="primary"
          onClick={handleFileUpload}
          disabled={loading}
          className="process-button"
        >
          {loading ? <Spin /> : "Upload and Extract Text"}
        </Button>

        {ocrResults.length > 0 && (
          <div className="ocr-results">
            <Divider orientation="left">OCR Results</Divider>
            {ocrResults.map((result, index) => (
              <Card key={index} title={result.fileName} className="ocr-card">
                <pre>{result.text}</pre>
              </Card>
            ))}
            <Button
              type="primary"
              onClick={handleAskAI}
              disabled={aiLoading}
              className="process-button"
            >
              {aiLoading ? <Spin /> : "Process with AI"}
            </Button>
          </div>
        )}

        {aiResponse && (
          <Card
            title="AI Extracted Information"
            bordered
            className="ai-response-card"
          >
            {renderAIResponse()}
          </Card>
        )}
      </Card>
    </div>
  );
};

export default MultiFileProcessor;
