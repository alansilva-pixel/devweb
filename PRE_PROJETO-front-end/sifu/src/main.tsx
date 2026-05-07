import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { Amplify } from "aws-amplify";

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_80JtNcIqE",
      userPoolClientId: "6ifqlm494093isjlq775sqpvrg",
      loginWith: {
        oauth: {
          domain: "us-east-180jtnciqe.auth.us-east-1.amazoncognito.com",
          scopes: ["email", "openid", "profile"],
          redirectSignIn: ["https://alanalmeida.sifu5.web.ufersa.dev.br", "http://localhost:5173/"],
          redirectSignOut: ["https://alanalmeida.sifu5.web.ufersa.dev.br", "http://localhost:5173/"],
          responseType: "code",
        },
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(<App />);