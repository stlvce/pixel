import type { FC, PropsWithChildren } from "react";
import { useState } from "react";

import { AuthContext } from "./authContext";

const AuthProvider: FC<PropsWithChildren> = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem("jwt"));

  return (
    <AuthContext
      value={{
        token,
        setToken: (newToken) => {
          setToken(newToken);
        },
      }}
    >
      {children}
    </AuthContext>
  );
};

export default AuthProvider;
