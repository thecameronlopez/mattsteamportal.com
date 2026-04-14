// import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from "react";
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
} from "react-router-dom";
import RootLayout from "./layout/RootLayout.jsx";
import ProtectedLayout from "./layout/ProtectedLayout.jsx";
import AdminLayout from "./layout/AdminLayout.jsx";
import Home from "./routes/Common/Home/Home.jsx";
import Login from "./routes/Common/Login/Login.jsx";
import Settings from "./routes/Admin/Settings/Settings.jsx";
import Scheduler from "./routes/Admin/Scheduler/Scheduler.jsx";
import TimeOffRequest from "./routes/Common/TimeOffRequest/TimeOffRequest.jsx";
import TimeOffStatus from "./routes/Admin/Status/TimeOffStatus.jsx";
import Posts from "./routes/Common/Portal/Posts/Posts.jsx";
import CreatePost from "./routes/Admin/CreatePost/CreatePost.jsx";
import Post from "./routes/Common/Portal/Post/Post.jsx";
import TeamSchedule from "./routes/Common/Teams/TeamSchedule/TeamSchedule.jsx";
import ForgotPassword from "./routes/Common/Login/ForgotPassword/ForgotPassword.jsx";
import ResetPassword from "./routes/Common/Login/ForgotPassword/ResetPassword.jsx";
import EditUser from "./routes/Common/User/EditUser.jsx";
import SubmitReceipt from "./routes/Common/Receipts/SubmitReceipt.jsx";
import ReceiptDesk from "./routes/Admin/Receipts/ReceiptDesk.jsx";

const App = () => {
  const router = createBrowserRouter(
    createRoutesFromElements(
      <Route path="/" element={<RootLayout />}>
        <Route path="login" element={<Login />} />
        <Route path="forgot-password" element={<ForgotPassword />} />
        <Route path="reset-password/:token" element={<ResetPassword />} />
        {/* <Route path="reset-password/" element={<ResetPassword />} /> */}
        <Route element={<ProtectedLayout />}>
          <Route index element={<Home />} />
          <Route path="time-off-request" element={<TimeOffRequest />} />
          <Route path="posts" element={<Posts />} />
          <Route path="post/:id" element={<Post />} />
          <Route path="team-schedules" element={<TeamSchedule />} />
          <Route path="receipts/submit" element={<SubmitReceipt />} />
          <Route path="edit-user/:id" element={<EditUser />} />
          <Route element={<AdminLayout />}>
            <Route path="settings" element={<Settings />} />
            <Route path="scheduler" element={<Scheduler />} />
            <Route path="time-off-status-update" element={<TimeOffStatus />} />
            <Route path="receipts/manage" element={<ReceiptDesk />} />
            <Route path="create-post" element={<CreatePost />} />
          </Route>
        </Route>
      </Route>,
    ),
  );
  return <RouterProvider router={router} />;
};

export default App;
