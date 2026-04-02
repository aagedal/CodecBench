import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import SetupPage from "./pages/SetupPage";
import BenchmarkConfigPage from "./pages/BenchmarkConfigPage";
import BenchmarkRunPage from "./pages/BenchmarkRunPage";
import ResultsPage from "./pages/ResultsPage";
import HistoryPage from "./pages/HistoryPage";
import ComparePage from "./pages/ComparePage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<SetupPage />} />
        <Route path="benchmark" element={<BenchmarkConfigPage />} />
        <Route path="benchmark/run" element={<BenchmarkRunPage />} />
        <Route path="results/:id" element={<ResultsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
