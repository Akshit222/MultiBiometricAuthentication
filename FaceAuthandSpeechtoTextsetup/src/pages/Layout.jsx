import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import Footer from "../components/Footer";

const whiteList = ["/protected","/record_voice"];

function Layout() {
  const location = useLocation();
  const { account } = JSON.parse(localStorage.getItem("faceAuth")) || {};

  if (!account && whiteList.includes(location.pathname)) {
    return <Navigate to="/" />;
  }

  if (account && !whiteList.includes(location.pathname)) {
    return <Navigate to="/record_voice" />;
  }

  return (
    <div className="h-screen flex flex-col justify-between">
      <Outlet className="grow" />
      <Footer />
    </div>
  );
}

export default Layout;
