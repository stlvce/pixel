import type { FC, PropsWithChildren } from "react";
import { useState } from "react";

import type { TUser } from "@src/api";

import { AuthContext } from "./authContext";

const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("jwt"));
  const [user, setUser] = useState<TUser | null>(null);

  return (
    <AuthContext
      value={{
        token,
        setToken: (newToken) => {
          setToken(newToken);
        },
        user,
        setUser: (newUser) => {
          setUser(newUser);
        },
      }}
    >
      {children}
    </AuthContext>
  );
};

export default AuthProvider;
