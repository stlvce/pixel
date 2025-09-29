import { useContext } from "react";
import type { FC, DetailedHTMLProps, ButtonHTMLAttributes } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

import RequestAPI from "@src/api";
import { AuthContext } from "@src/store";

type TRecaptchaProps = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> & { onSuccess: () => void, isLoading: boolean };

const Recaptcha: FC<TRecaptchaProps> = ({
  onSuccess,
  isLoading,
  disabled,
  children,
  ...props
}) => {
  const { token, user } = useContext(AuthContext);
  const { executeRecaptcha } = useGoogleReCaptcha();


  const handleClick = async () => {
    if (user?.status === "banned") return;

    if (!executeRecaptcha) {
      console.log("Execute recaptcha not yet available");
      return;
    }

    const captcha = await executeRecaptcha();

    if (token) {
      RequestAPI.checkCaptcha(token, captcha)
        .then(() => {})
        .catch((err) => {
          console.log(err);
        })
    }

    onSuccess();
  };

  return (
    <button {...props} onClick={handleClick} disabled={disabled || isLoading}>
      {isLoading && <span className="loading loading-spinner" />}
      {children}
    </button>
  );
};

export default Recaptcha;
