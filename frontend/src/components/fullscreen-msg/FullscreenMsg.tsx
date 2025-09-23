import type { TFullscreenMsg } from "./FullscreenMsg.types";

const FullscreenMsg: TFullscreenMsg = ({ text }) => {
  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 bg-zinc-500/40 z-3 flex justify-center items-center">
      <span className="text-error font-bold text-4xl">{text}</span>
    </div>
  );
};

export default FullscreenMsg;
