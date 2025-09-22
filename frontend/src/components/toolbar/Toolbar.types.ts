import type { TPickColorProps } from "@src/UI/pick-color/PickColor.types";

export type TToolbarProps = TPickColorProps & {
  isAdmin: boolean;
  selectEditMode: () => void;
  selectRemoveMode: () => void;
};
