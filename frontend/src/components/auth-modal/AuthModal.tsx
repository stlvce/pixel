const AuthModal = () => {
  return (
    <>
      <button
        className="btn btn-primary fixed z-10 right-5 top-5"
        onClick={() => document.getElementById("my_modal_1").showModal()}
      >
        Войти
      </button>
      <dialog id="my_modal_1" className="modal">
        <div className="modal-box">
          <h3 className="font-bold text-lg">Hello!</h3>
          <p className="py-4">
            Press ESC key or click the button below to close
          </p>
          <div className="modal-action">
            <form method="dialog">
              {/* if there is a button in form, it will close the modal */}
              <button className="btn">Close</button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
};

export default AuthModal;
