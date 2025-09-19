import { useContext, useEffect, useState } from "react";

import GoogleAuth from "@src/libs/google-auth";
import { AuthContext } from "@src/store";
import RequestAPI from "@src/api";

const AuthModal = () => {
  const { token, setToken, user, setUser } = useContext(AuthContext);
  const [isLoading, setIsLoading] = useState(true);

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
        setIsLoading(false);
      })
      .catch((err: Response) => {
        if (err.status === 401) handleLogout();
      });
    // TODO только если expire token
  }, [token]);

  if (token) {
    return isLoading ? (
      <div className="skeleton shrink-0 rounded-full w-12 h-12 fixed z-10 right-2 top-2" />
    ) : (
      <div className="dropdown dropdown-end fixed z-10 right-2 top-2">
        <div className="avatar indicator">
          {user?.is_admin === 1 && (
            <span className="indicator-item indicator-bottom indicator-start stroke-primary bg-white rounded-full p-0.5">
              <svg
                className="size-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
                />
              </svg>
            </span>
          )}

          <div
            className="avatar avatar-placeholder cursor-pointer"
            tabIndex={0}
            role="button"
          >
            <div className="bg-info text-neutral-content w-12 rounded-full">
              <span className="text-xl">
                {user?.email ? user.email.substring(0, 1).toUpperCase() : ""}
              </span>
            </div>
          </div>
        </div>

        <ul
          tabIndex={0}
          className="dropdown-content menu bg-white rounded-box z-1 w-52 p-5 shadow-md mt-2 border-1 border-gray-200"
        >
          <li className="mb-5 color-primary font-semibold">{user?.email}</li>
          <li>
            <button className="btn btn-soft btn-error" onClick={handleLogout}>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="size-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15m-3 0-3-3m0 0 3-3m-3 3H15"
                />
              </svg>
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
