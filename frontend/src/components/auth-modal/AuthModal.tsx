import { useContext } from "react";

import GoogleAuth from "@src/libs/google-auth";
import { AuthContext } from "@src/store";

const AuthModal = () => {
  const { token, setToken } = useContext(AuthContext);

  const openAuthModal = () => {
    const authModal = document.getElementById(
      "auth-modal",
    ) as HTMLDialogElement;

    if (authModal) {
      authModal.showModal();
    }
  };

  const handleLogout = () => {
    setToken(null);
    localStorage.removeItem("jwt");
  };

  if (token) {
    return (
      <button className="btn fixed z-10 right-5 top-5" onClick={handleLogout}>
        Выйти
      </button>
    );
  }

  return (
    <>
      <button className="btn fixed z-10 right-5 top-5" onClick={openAuthModal}>
        Войти
      </button>
      <dialog id="auth-modal" className="modal">
        <div className="modal-box">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">
              ✕
            </button>
          </form>
          <h3 className="font-bold text-lg">Вход</h3>
          <div className="p-5">
            <GoogleAuth onSuccess={setToken} />
          </div>
        </div>

        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </>
  );
};

export default AuthModal;
