import {
  Navigate,
  Route,
  createBrowserRouter,
  createRoutesFromElements,
} from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import UserSelect from "./pages/UserSelect.jsx";
import Protected from "./pages/Protected";

const router = createBrowserRouter(
  createRoutesFromElements(
    <>
      <Route path="/" element={<Home />} />
      <Route path="user-select" element={<UserSelect />} />
      <Route path="login" element={<Login />} />
      <Route path="protected" element={<Protected />} />
      <Route 
        path="record" 
        element={<Navigate to="http://localhost:5000/record" replace />} 
      /> {/* Redirect to external URL */}
      <Route path="*" element={<Navigate to="/" />} />
    </>
  ),
  { basename: "/" }
);

export default router;
