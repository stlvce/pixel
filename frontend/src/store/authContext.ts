import { createContext } from "react";

type TAuthContextValues = {
  token: string | null;
  setToken: (token: string | null) => void;
};

export const AuthContext = createContext<TAuthContextValues>({
  token: null,
  setToken: () => null,
});
