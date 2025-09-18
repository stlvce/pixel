import { createContext } from "react";

import type { TUser } from "@src/api";

type TAuthContextValues = {
  token: string | null;
  setToken: (token: string | null) => void;
  user: TUser | null;
  setUser: (user: TUser | null) => void;
};

export const AuthContext = createContext<TAuthContextValues>({
  token: null,
  setToken: () => null,
  user: null,
  setUser: () => null,
});
