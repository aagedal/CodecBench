import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/layout/Layout";
import SetupPage from "./pages/SetupPage";
import BenchmarkConfigPage from "./pages/BenchmarkConfigPage";
import BenchmarkRunPage from "./pages/BenchmarkRunPage";
import ResultsPage from "./pages/ResultsPage";
import HistoryPage from "./pages/HistoryPage";
import ComparePage from "./pages/ComparePage";
import QualityBenchmarkPage from "./pages/QualityBenchmarkPage";
import TrendsPage from "./pages/TrendsPage";
import VideoComparePage from "./pages/VideoComparePage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<SetupPage />} />
        <Route path="benchmark" element={<BenchmarkConfigPage />} />
        <Route path="quality" element={<QualityBenchmarkPage />} />
        <Route path="benchmark/run" element={<BenchmarkRunPage />} />
        <Route path="results/:id" element={<ResultsPage />} />
        <Route path="history" element={<HistoryPage />} />
        <Route path="compare" element={<ComparePage />} />
        <Route path="trends" element={<TrendsPage />} />
        <Route path="video-compare/:id" element={<VideoComparePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
