import type { FC } from "react";
import { useContext } from "react";

import { AuthContext } from "@src/store";

type TPaintPopupProps = {
  selectedPixel: { x: number; y: number } | null;
  handlePlacePixel: () => void;
  onCancel: () => void;
  cooldown: number;
};

const PaintPopup: FC<TPaintPopupProps> = ({
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
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 bg-white px-5 py-2.5 rounded-lg shadow-xl/10 border-1 border-gray-200">
      <p className="text-zinc-800">
        Пиксель: {selectedPixel.x}, {selectedPixel.y}
      </p>
      <div className="flex gap-2 mt-2">
        <button
          className="btn btn-primary"
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
