import { useContext, useEffect } from "react";

import GoogleAuth from "@src/libs/google-auth";
import { AuthContext } from "@src/store";
import RequestAPI from "@src/api";

const AuthModal = () => {
  const { token, setToken, user, setUser } = useContext(AuthContext);

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
  }, []);

  useEffect(() => {
    if (!token) return;

    RequestAPI.getMe(token)
      .then((res) => {
        setUser(res);
      })
      .catch(handleLogout);
    // TODO только если expire token
  }, [token]);

  if (token) {
    return (
      <div className="dropdown dropdown-end fixed z-10 right-2 top-2">
        <div
          className="avatar avatar-placeholder cursor-pointer"
          tabIndex={0}
          role="button"
        >
          <div className="bg-neutral text-neutral-content w-12 rounded-full">
            <span className="text-xl">
              {user?.email ? user.email.substring(0, 1).toUpperCase() : ""}
            </span>
          </div>
        </div>

        <ul
          tabIndex={0}
          className="dropdown-content menu bg-base-300 rounded-box z-1 w-52 p-5 shadow-sm mt-2"
        >
          <li className="mb-5">{user?.email}</li>
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
      <button className="btn fixed z-10 right-2 top-2" onClick={openAuthModal}>
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
