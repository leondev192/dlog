// LoadingScreen.js
import React, { useEffect } from "react";
import "./LoadingScreen.scss"; // Import CSS/SCSS với hiệu ứng đã tạo

const LoadingScreen = ({ onFinish }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish(); // Gọi hàm khi loading hoàn thành
    }, 5000); // 5 giây

    return () => clearTimeout(timer); // Dọn dẹp bộ đếm thời gian
  }, [onFinish]);

  return (
    <div id="container">
      <netflixintro letter="N">
        <div className="helper-1">
          <div className="effect-brush">
            {[...Array(31).keys()].map((i) => (
              <span key={i} className={`fur-${i + 1}`}></span>
            ))}
          </div>
          <div className="effect-lumieres">
            {[...Array(28).keys()].map((i) => (
              <span key={i} className={`lamp-${i + 1}`}></span>
            ))}
          </div>
        </div>
        <div className="helper-2">
          <div className="effect-brush">
            {[...Array(31).keys()].map((i) => (
              <span key={i} className={`fur-${i + 1}`}></span>
            ))}
          </div>
        </div>
        <div className="helper-3">
          <div className="effect-brush">
            {[...Array(31).keys()].map((i) => (
              <span key={i} className={`fur-${i + 1}`}></span>
            ))}
          </div>
        </div>
        <div className="helper-4">
          <div className="effect-brush">
            {[...Array(31).keys()].map((i) => (
              <span key={i} className={`fur-${i + 1}`}></span>
            ))}
          </div>
        </div>
      </netflixintro>
    </div>
  );
};

export default LoadingScreen;
