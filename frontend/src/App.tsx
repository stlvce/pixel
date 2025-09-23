import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { GoogleReCaptchaProvider } from "react-google-recaptcha-v3";

import { AuthProvider } from "@src/store";
import { UserPlace, ModPlace } from "@src/pages";

const router = createBrowserRouter([
  {
    path: "/",
    element: <UserPlace />,
  },
  {
    path: "/mod",
    element: <ModPlace />,
  },
]);

const App = () => {
  return (
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID ?? ""}>
      <AuthProvider>
        <GoogleReCaptchaProvider
          reCaptchaKey={import.meta.env.VITE_RECAPTCHA_KEY}
          language="ru"
        >
          <RouterProvider router={router} />
        </GoogleReCaptchaProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
};

export default App;
