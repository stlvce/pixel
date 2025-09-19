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
        <div className="avatar indicator">
          {user?.is_admin === 1 && (
            <span className="indicator-item indicator-bottom indicator-start">
              <svg
                className="size-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
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
            <div className="bg-neutral text-neutral-content w-12 rounded-full">
              <span className="text-xl">
                {user?.email ? user.email.substring(0, 1).toUpperCase() : ""}
              </span>
            </div>
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
