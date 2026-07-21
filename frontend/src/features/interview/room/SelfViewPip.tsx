import { Mic, MicOff } from "lucide-react";

type Props = {
  videoRef: (node: HTMLVideoElement | null) => void;
  visible: boolean;
  micEnabled: boolean;
};

export default function SelfViewPip({ videoRef, visible, micEnabled }: Props) {
  if (!visible) return null;

  return (
    <div className="ir-pip glass-panel" aria-label="Your camera preview">
      <video ref={videoRef} className="ir-pip__video" playsInline muted autoPlay />
      <div className="ir-pip__badge">
        {micEnabled ? (
          <Mic size={12} className="ir-pip__mic ir-pip__mic--on" aria-hidden />
        ) : (
          <MicOff size={12} className="ir-pip__mic" aria-hidden />
        )}
        <span>You</span>
      </div>
    </div>
  );
}
