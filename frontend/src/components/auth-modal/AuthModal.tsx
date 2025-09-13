import { useContext, useEffect } from "react";

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

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const token = queryParams.get("token");
    if (token) {
      setToken(token);
      localStorage.setItem("jwt", token);
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, [setToken]);

  if (token) {
    return (
      <div className="dropdown dropdown-end fixed z-10 right-5 top-5">
        <div
          className="avatar avatar-placeholder cursor-pointer"
          tabIndex={0}
          role="button"
        >
          <div className="bg-neutral text-neutral-content w-10 rounded-full">
            <span className="text-xl">D</span>
          </div>
        </div>

        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-300 rounded-box z-1 w-52 p-5 shadow-sm mt-2"
        >
          <li className="mb-5">username</li>
          <li>
            <button
              className="btn btn-outline btn-error"
              onClick={handleLogout}
            >
              Выйти
            </button>
          </li>
        </ul>
      </div>
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
          <div className="pt-5">
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
