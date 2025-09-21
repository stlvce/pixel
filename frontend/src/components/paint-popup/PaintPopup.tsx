import type { FC } from "react";

import Recaptcha from "@src/libs/recaptcha";

type TPaintPopupProps = {
  color: string;
  selectedPixel: { x: number; y: number } | null;
  handlePlacePixel: () => void;
  onCancel: () => void;
  cooldown: number;
};

const PaintPopup: FC<TPaintPopupProps> = ({
  color,
  selectedPixel,
  handlePlacePixel,
  onCancel,
  cooldown,
}) => {
  const handlePaint = () => {
    handlePlacePixel();
  };

  if (!selectedPixel) return null;

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white rounded-lg shadow-xl/10 border-1 border-gray-200 w-57">
      <div className="relative pt-5 px-5 pb-3">
        <button
          className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          onClick={onCancel}
        >
          ✕
        </button>
        <div className="flex items-center gap-2">
          <span
            className={`w-4 h-4 rounded-sm border border-neutral-content`}
            style={{ backgroundColor: color }}
          />
          <p className="text-zinc-800">
            Пиксель: {selectedPixel.x}, {selectedPixel.y}
          </p>
        </div>
        <Recaptcha
          className="btn btn-primary mt-3 w-full"
          onSuccess={handlePaint}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Подожди ${cooldown}с` : "Поставить"}
        </Recaptcha>
      </div>
    </div>
  );
};

export default PaintPopup;
