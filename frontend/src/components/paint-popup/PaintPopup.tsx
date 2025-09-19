import type { FC } from "react";
import { useContext } from "react";

import { AuthContext } from "@src/store";

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
  const { token } = useContext(AuthContext);

  const handlePaint = () => {
    if (!token) {
      const authModal = document.getElementById(
        "auth-modal",
      ) as HTMLDialogElement;

      if (authModal) {
        authModal.showModal();
      }

      return;
    }

    handlePlacePixel();
  };

  if (!selectedPixel) return null;

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white px-5 py-2.5 rounded-lg shadow-xl/10 border-1 border-gray-200 w-70">
      <div className="flex items-center gap-2">
        <span
          className={`w-4 h-4 mt-1 rounded-sm border border-zinc-800`}
          style={{ backgroundColor: color }}
        />
        <p className="text-zinc-800">
          Пиксель: {selectedPixel.x}, {selectedPixel.y}
        </p>
      </div>
      <div className="flex mt-2 gap-3">
        <button
          className="btn btn-primary flex-1"
          onClick={handlePaint}
          disabled={cooldown > 0}
        >
          {cooldown > 0 ? `Подожди ${cooldown}с` : "Поставить"}
        </button>
        <button className="btn btn-neutral btn-outline" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </div>
  );
};

export default PaintPopup;
