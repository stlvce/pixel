import type { FC } from "react";
import { GoogleLogin } from "@react-oauth/google";
import type { CredentialResponse } from "@react-oauth/google";
import { jwtDecode } from "jwt-decode";

import RequestAPI from "@src/api";

type TGoogleAuthProps = {
  onSuccess: (token: string) => void;
};

const GoogleAuth: FC<TGoogleAuthProps> = ({ onSuccess }) => {
  const handleLoginSuccess = (credentialResponse: CredentialResponse) => {
    const token = credentialResponse.credential;

    if (!token) return;

    const userInfo = jwtDecode(token);

    console.log("Google user:", userInfo);

    RequestAPI.authGoogle(token)
      .then((res) => res.json())
      .then((data) => {
        console.log("Наш JWT:", data);
        localStorage.setItem("jwt", data.access_token);
        onSuccess(data.access_token);
      });
  };

  const handleLoginError = () => console.log("Google Login Failed");

  return (
    <GoogleLogin onSuccess={handleLoginSuccess} onError={handleLoginError} />
  );
};

export default GoogleAuth;
