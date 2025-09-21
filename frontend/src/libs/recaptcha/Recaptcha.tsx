import { useContext, useState } from "react";
import type { FC, DetailedHTMLProps, ButtonHTMLAttributes } from "react";
import { useGoogleReCaptcha } from "react-google-recaptcha-v3";

import RequestAPI from "@src/api";
import { AuthContext } from "@src/store";

type TRecaptchaProps = DetailedHTMLProps<
  ButtonHTMLAttributes<HTMLButtonElement>,
  HTMLButtonElement
> & { onSuccess: () => void };

const Recaptcha: FC<TRecaptchaProps> = ({
  onSuccess,
  disabled,
  children,
  ...props
}) => {
  const { token, user } = useContext(AuthContext);
  const { executeRecaptcha } = useGoogleReCaptcha();

  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (user?.status === "banned") return;

    if (!token) {
      const authModal = document.getElementById(
        "auth-modal",
      ) as HTMLDialogElement;

      if (authModal) {
        authModal.showModal();
      }

      return;
    }

    if (!executeRecaptcha) {
      console.log("Execute recaptcha not yet available");
      return;
    }

    const captcha = await executeRecaptcha();

    if (token) {
      setIsLoading(true);

      RequestAPI.checkCaptcha(token, captcha)
        .then(() => {
          onSuccess();
        })
        .catch((err) => {
          console.log(err);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  };

  return (
    <button {...props} onClick={handleClick} disabled={disabled || isLoading}>
      {isLoading && <span className="loading loading-spinner" />}
      {children}
    </button>
  );
};

export default Recaptcha;
