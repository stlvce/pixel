import type { FC } from "react";

import type { TControlButtonsProps } from "./ControlButtons.types";

const ControlButtons: FC<TControlButtonsProps> = ({
  onZoomIn,
  onZoomOut,
  onUp,
  onDown,
  onLeft,
  onRight,
}) => {
  return (
    <div className="absolute left-5 bottom-5 flex flex-col gap-2 select-none hidden md:flex">
      <div className="flex justify-center gap-5">
        <div className="relative">
          <button className="btn w-10" onClick={onZoomIn}>
            +
          </button>
          <kbd className="kbd kbd-xs absolute -top-1 -right-1">Q</kbd>
        </div>
        <button className="btn w-10" onClick={onUp}>
          ▲
        </button>
        <div className="relative">
          <button className="btn w-10" onClick={onZoomOut}>
            -
          </button>
          <kbd className="kbd kbd-xs absolute -top-1 -right-1">W</kbd>
        </div>
      </div>
      <div className="flex justify-center gap-5">
        <button className="btn w-10" onClick={onLeft}>
          ◀︎
        </button>
        <button className="btn w-10" onClick={onDown}>
          ▼
        </button>
        <button className="btn w-10" onClick={onRight}>
          ▶︎
        </button>
      </div>
    </div>
  );
};

export default ControlButtons;
