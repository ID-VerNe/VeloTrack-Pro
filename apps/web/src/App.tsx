import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import RideDetail from './pages/RideDetail';
import AICoach from './pages/AICoach';
import PeriodicReports from './pages/PeriodicReports';
import ActivitiesList from './pages/ActivitiesList';
import RoutesExplorer from './pages/RoutesExplorer';
import TrainingGoals from './pages/TrainingGoals';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/reports" element={<PeriodicReports />} />
        <Route path="/rides" element={<ActivitiesList />} />
        <Route path="/routes" element={<RoutesExplorer />} />
        <Route path="/goals" element={<TrainingGoals />} />
        <Route path="/ai-coach" element={<AICoach />} />
        <Route path="/ride/:id" element={<RideDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
