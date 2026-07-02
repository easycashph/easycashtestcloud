import { Routes, Route } from 'react-router-dom';

/**
 * Placeholder root shell for Milestone 3 (project initialization).
 * Real routes/features/pages are built out in Milestone 9 (Frontend),
 * mirroring the backend module boundaries under src/features/.
 */
function Placeholder() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-slate-800">EasyCash Digital Lending Platform</h1>
        <p className="mt-2 text-sm text-slate-500">Frontend scaffold initialized — features land in Milestone 9.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="*" element={<Placeholder />} />
    </Routes>
  );
}
