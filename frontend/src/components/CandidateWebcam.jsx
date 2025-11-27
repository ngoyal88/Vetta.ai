import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

const CandidateWebcam = () => {
  const videoRef = useRef(null);

  useEffect(() => {
    const currentVideo = videoRef.current;

    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (currentVideo) {
          currentVideo.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("Webcam error:", err);
      });

    return () => {
      if (currentVideo && currentVideo.srcObject) {
        currentVideo.srcObject.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full h-full bg-black rounded-lg overflow-hidden"
    >
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-cover transform scale-x-[-1]"
        disablePictureInPicture
        controls={false}
        onContextMenu={(e) => e.preventDefault()}
      />
      
      {/* Label */}
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-white text-xs font-medium">
        You
      </div>
    </motion.div>
  );
};

export default CandidateWebcam;