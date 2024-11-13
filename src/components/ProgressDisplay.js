import React from "react";
import { Progress } from "antd";

const ProgressDisplay = ({ progress, loading }) => {
  if (!loading) return null;

  return (
    <div style={{ marginTop: "16px" }}>
      <Progress percent={progress} />
    </div>
  );
};

export default ProgressDisplay;
