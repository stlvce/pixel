import type { FC } from "react";

import type { TPickColorProps } from "./PickColor.types";

const PickColor: FC<TPickColorProps> = ({ color, changeColor }) => {
  return (
    <div className="bg-white flex align-center justify-center p-2 rounded-sm border border-gray-200 shadow-lg">
      <input
        className="w-10 h-10"
        type="color"
        value={color}
        onChange={(e) => {
          changeColor(e.target.value);
        }}
      />
    </div>
  );
};

export default PickColor;
