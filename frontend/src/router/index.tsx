import { createBrowserRouter } from "react-router-dom";
import Home from "../pages/Home.tsx";
import Room from "../pages/Room.tsx";
import NotFound from "../pages/NotFound.tsx";

export const router = createBrowserRouter([
    {
        path: "/",
        element: <Home />,
    },
    {
        path: "/room",
        element: <Room />,
    },
    {
        path: "*",
        element: <NotFound />,
    },
]);
