import React from "react";
import { Card, Typography, Button } from "antd";

const { Paragraph } = Typography;

const AIResponseViewer = ({ aiResponse, onExport, onReset }) => {
  if (!aiResponse) return null;

  return (
    <Card title="AI Extracted Information" bordered>
      <Paragraph style={{ whiteSpace: "pre-line" }}>
        {Object.entries(aiResponse)
          .map(([key, value]) => `${key}: ${value}`)
          .join("\n")}
      </Paragraph>
      <div style={{ marginTop: "16px" }}>
        <Button
          type="primary"
          onClick={onExport}
          style={{ marginRight: "8px" }}
        >
          Export to Excel Template
        </Button>
        <Button onClick={onReset}>Reset</Button>
      </div>
    </Card>
  );
};

export default AIResponseViewer;
