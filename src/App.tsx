import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Landing } from "./screens/Landing";
import { Room } from "./screens/Room";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/room/:code" element={<Room />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
